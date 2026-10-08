// Faxina das salas. Roda via GitHub Actions agendado (.github/workflows/cleanup-rooms.yml), usando
// uma conta de serviço que ignora firestore.rules — é o substituto ao TTL nativo do Firestore, que
// exigiria o plano pago Blaze (ver CLAUDE.md). Dois passos, nesta ordem:
//   1. apaga salas encerradas com deleteAt vencido;
//   2. fecha salas abertas abandonadas (sem atividade), velhas demais (24h) ou acima do teto de
//      salas ativas do dono (as menos ativas primeiro) -- as decisões ficam em cleanup-logic.mjs.
//      O fechamento grava deleteAt, então o passo 1 de uma próxima execução apaga a sala.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { planClosures, reasonStillApplies, retentionMs } from './cleanup-logic.mjs';

if (process.env.FIRESTORE_EMULATOR_HOST) {
  // O Admin SDK manda tudo pro emulator quando essa variável existe, com ou sem credencial. Sem o
  // opt-in, uma variável esquecida no shell faria a "faxina de produção" rodar no emulator, em silêncio.
  if (process.env.CLEANUP_ALLOW_EMULATOR !== '1') {
    console.error('FIRESTORE_EMULATOR_HOST está definido: a faxina rodaria no emulator, não em produção. Limpe a variável (ou use CLEANUP_ALLOW_EMULATOR=1, só nos testes).');
    process.exit(1);
  }

  // testes (npm run test:cron): sem credencial
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-cleanup-test' });
} else {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.error('Env FIREBASE_SERVICE_ACCOUNT ausente (ver README).');
    process.exit(1);
  }

  initializeApp({ credential: cert(JSON.parse(raw)) });
}

const db = getFirestore();
let failures = 0;

// ---------- 1. apagar encerradas e vencidas ----------
const dueSnapshot = await db.collection('rooms')
  .where('status', '==', 'closed')
  .where('deleteAt', '<=', Timestamp.now())
  .get();

console.log(`Salas encerradas e vencidas: ${dueSnapshot.size}`);

for (const roomDoc of dueSnapshot.docs) {
  const room = roomDoc.data();
  const memberUids = Object.keys(room.members ?? {});

  try {
    // índice "minhas salas" de cada participante (rounds/votes somem com recursiveDelete abaixo)
    await Promise.all(memberUids.map(async (uid) => {
      try {
        await db.collection('users').doc(uid).collection('rooms').doc(roomDoc.id).delete();
      } catch (error) {
        console.warn(`Aviso: não apagou o índice de ${uid} pra ${roomDoc.id}: ${error.message}`);
      }
    }));

    await db.recursiveDelete(roomDoc.ref);
    // sem o título aqui de propósito: repo é público, log do Actions também -- título de
    // sala pode ter nome de projeto/cliente que o dono não quer nesse histórico
    console.log(`Apagada: ${roomDoc.id}`);
  } catch (error) {
    failures++;
    console.error(`Falhou ao apagar ${roomDoc.id}: ${error.message}`);
  }
}

// ---------- 2. fechar abandonadas, velhas e excedentes ----------
// uma leitura só das abertas (igualdade em um campo: não precisa de índice composto); a
// decisão é em memória. Poucas centenas de salas abertas cabem folgado na cota do Spark.
const nowMs = Date.now();
const openSnapshot = await db.collection('rooms').where('status', '==', 'open').get();
const globalLimits = (await db.collection('config').doc('limits').get()).data();
const userLimitsByUid = Object.fromEntries((await db.collection('userLimits').get()).docs.map((limitDoc) => [limitDoc.id, limitDoc.data()]));

const plan = planClosures(
  openSnapshot.docs.map((roomDoc) => ({ id: roomDoc.id, ...roomDoc.data() })),
  { globalLimits, userLimitsByUid },
  nowMs,
);

console.log(`Salas abertas: ${openSnapshot.size}; a fechar: ${plan.length}`);

const closed = { inativa: 0, idade: 0, teto: 0 };

for (const { id, reason } of plan) {
  const roomRef = db.collection('rooms').doc(id);

  try {
    const didClose = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(roomRef);

      if (!fresh.exists || !reasonStillApplies(reason, fresh.data(), nowMs)) {
        return false;
      }

      tx.update(roomRef, { status: 'closed', deleteAt: Timestamp.fromMillis(nowMs + retentionMs(fresh.data())) });
      return true;
    });

    if (didClose) {
      closed[reason]++;
      // só id e motivo: sem título nem dono (log público, como no passo 1)
      console.log(`Fechada (${reason}): ${id}`);
    }
  } catch (error) {
    failures++;
    console.error(`Falhou ao fechar ${id}: ${error.message}`);
  }
}

console.log(`Fechadas: ${closed.inativa} inativa(s), ${closed.idade} velha(s), ${closed.teto} acima do teto.`);
console.log(`Faxina concluída. ${failures > 0 ? `${failures} falha(s), tentam de novo na próxima execução.` : ''}`);

if (failures > 0) {
  process.exitCode = 1;
}
