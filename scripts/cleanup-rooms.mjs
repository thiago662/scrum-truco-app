// Faxina das salas. Roda via GitHub Actions agendado (.github/workflows/cleanup-rooms.yml), usando
// uma conta de serviço que ignora firestore.rules — é o substituto ao TTL nativo do Firestore, que
// exigiria o plano pago Blaze (ver CLAUDE.md). Passos, nesta ordem:
//   0. (só com o secret ADMIN_EMAILS) garante a conta ilimitada de cada e-mail da lista;
//   1. apaga salas encerradas com deleteAt vencido;
//   2. fecha salas abertas abandonadas (sem atividade), velhas demais (24h) ou acima do teto de
//      salas ativas do dono (as menos ativas primeiro) -- as decisões ficam em cleanup-logic.mjs.
//      O fechamento grava deleteAt, então o passo 1 de uma próxima execução apaga a sala.
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin, parseEmails } from './admin-init.mjs';
import { planClosures, reasonStillApplies, retentionMs } from './cleanup-logic.mjs';

initAdmin();

const db = getFirestore();
let failures = 0;

// ---------- 0. contas ilimitadas (secret ADMIN_EMAILS) ----------
// Garante userLimits/{uid}.unlimited = true pra cada e-mail da lista, antes de ler os limites (o
// teto de salas abaixo já vale pra elas na mesma execução). Só concede, nunca revoga: pra revogar,
// apague o doc no console. E-mail sem conta ainda é ignorado (cadastre-se no app primeiro; ver
// README). Log sem e-mail: só uid abreviado.
for (const email of parseEmails(process.env.ADMIN_EMAILS)) {
  try {
    const { uid } = await getAuth().getUserByEmail(email);
    await db.collection('userLimits').doc(uid).set({ unlimited: true }, { merge: true });
    console.log(`Conta ilimitada garantida: ${uid.slice(0, 6)}…`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('ADMIN_EMAILS: um e-mail ainda não tem conta; ignorado.');
    } else {
      // só aviso, sem falhar a execução: um e-mail mal digitado no secret deixaria a faxina
      // vermelha a cada 3h e esconderia falha de limpeza de verdade. Tenta de novo na próxima.
      console.warn(`Aviso: não garantiu uma conta ilimitada (${error.code ?? 'erro'}); confira o secret ADMIN_EMAILS.`);
    }
  }
}

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
