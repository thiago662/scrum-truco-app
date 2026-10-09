// Limpa a base antes da divulgação: apaga TODAS as salas (com rounds/votes), os índices "minhas
// salas" e os perfis + contas do Auth de quem não está em KEEP_EMAILS. Contas mantidas ficam com
// o perfil e o userLimits; config/limits não é tocado.
//
// Dry-run por padrão (só conta e mostra). Só apaga com --confirm. Roda como workflow manual
// (.github/workflows/purge-data.yml) ou local. É deleção em produção: quem roda é o dono.
//   KEEP_EMAILS="a@x.com,b@y.com"  (obrigatório: sem ele a purge apagaria até a sua conta)
//   node scripts/purge-data.mjs [--confirm]
// Logs só com contagens: o workflow é público, e e-mails/títulos não devem aparecer nele.
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin, parseEmails } from './admin-init.mjs';

initAdmin();

const db = getFirestore();
const auth = getAuth();
const confirm = process.argv.includes('--confirm');

const keepEmails = parseEmails(process.env.KEEP_EMAILS);

if (keepEmails.length === 0) {
  console.error('KEEP_EMAILS ausente: sem ele a purge apagaria todas as contas, inclusive a sua.');
  process.exit(1);
}

const keepUids = new Set();

for (const email of keepEmails) {
  try {
    keepUids.add((await auth.getUserByEmail(email)).uid);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    console.warn('Um e-mail de KEEP_EMAILS não tem conta; ignorado.');
  }
}

// nenhuma conta mantida encontrada = e-mail digitado errado: recusa em vez de apagar todo mundo
if (keepUids.size === 0) {
  console.error('Nenhum e-mail de KEEP_EMAILS tem conta: recuso a purge (apagaria todas as contas).');
  process.exit(1);
}

const authUids = [];
let pageToken;

do {
  const page = await auth.listUsers(1000, pageToken);
  authUids.push(...page.users.map((user) => user.uid));
  pageToken = page.pageToken;
} while (pageToken);

const deleteUids = authUids.filter((uid) => !keepUids.has(uid));
// listDocuments também devolve docs "fantasma" (sem campos, só com subcoleção), caso de users/{uid}
const rooms = await db.collection('rooms').listDocuments();
const userDocs = await db.collection('users').listDocuments();
const limitDocs = await db.collection('userLimits').listDocuments();

const dropUserDocs = userDocs.filter((ref) => !keepUids.has(ref.id));
const dropLimitDocs = limitDocs.filter((ref) => !keepUids.has(ref.id));

console.log(`Contas mantidas: ${keepUids.size}`);
console.log(`Salas a apagar: ${rooms.length}`);
console.log(`Contas do Auth a apagar: ${deleteUids.length}`);
console.log(`Perfis (users) a apagar: ${dropUserDocs.length}; índices "minhas salas" das contas mantidas: limpos`);
console.log(`userLimits a apagar: ${dropLimitDocs.length}`);

if (!confirm) {
  console.log('Dry-run: nada foi apagado. Rode de novo com --confirm (ou modo "apagar" no workflow).');
  process.exit(0);
}

// salas primeiro: com todas apagadas, qualquer índice de "minhas salas" aponta pro nada
await db.recursiveDelete(db.collection('rooms'));

for (const uid of keepUids) {
  await db.recursiveDelete(db.collection('users').doc(uid).collection('rooms'));
}

for (const ref of dropUserDocs) {
  await db.recursiveDelete(ref);
}

for (const ref of dropLimitDocs) {
  await ref.delete();
}

let authFailures = 0;

for (let i = 0; i < deleteUids.length; i += 1000) {
  const result = await auth.deleteUsers(deleteUids.slice(i, i + 1000));
  authFailures += result.failureCount;
}

console.log(`Purge concluída. ${authFailures > 0 ? `${authFailures} conta(s) do Auth falharam; rode de novo.` : ''}`);

if (authFailures > 0) {
  process.exitCode = 1;
}
