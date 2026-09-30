// Faxina das salas encerradas e vencidas (deleteAt <= agora). Roda via GitHub Actions agendado
// (.github/workflows/cleanup-rooms.yml), usando uma conta de serviço que ignora firestore.rules —
// é o substituto ao TTL nativo do Firestore, que exigiria o plano pago Blaze (ver CLAUDE.md).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!raw) {
  console.error('Env FIREBASE_SERVICE_ACCOUNT ausente (ver README).');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const snapshot = await db.collection('rooms')
  .where('status', '==', 'closed')
  .where('deleteAt', '<=', Timestamp.now())
  .get();

console.log(`Salas encerradas e vencidas: ${snapshot.size}`);

let failures = 0;

for (const roomDoc of snapshot.docs) {
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

console.log(`Faxina concluída. ${failures > 0 ? `${failures} falha(s), tentam de novo na próxima execução.` : ''}`);

if (failures > 0) {
  process.exitCode = 1;
}
