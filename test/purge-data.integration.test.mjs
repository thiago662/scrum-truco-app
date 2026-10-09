// Roda scripts/purge-data.mjs de verdade contra os emuladores de Firestore e Auth. Rodar com:
// npm run test:cron (precisa de: npm install --no-save firebase-admin@14.5.0)
import { spawnSync } from 'node:child_process';
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

let admin;
try {
  admin = {
    app: await import('firebase-admin/app'),
    auth: await import('firebase-admin/auth'),
    firestore: await import('firebase-admin/firestore'),
  };
} catch {
  // falha alto no before, em vez de pular (ver cleanup-rooms.integration.test.mjs)
}

describe('purge-data.mjs contra os emuladores', () => {
  let db;
  let auth;

  const run = (args = [], env = {}) => spawnSync(process.execPath, ['scripts/purge-data.mjs', ...args], {
    env: { ...process.env, ALLOW_EMULATOR: '1', KEEP_EMAILS: 'dono@example.com', ...env },
    encoding: 'utf8',
  });
  const out = (result) => result.stdout + result.stderr;
  const uids = async () => (await auth.listUsers()).users.map((user) => user.uid).sort();
  const exists = async (path) => (await db.doc(path).get()).exists;

  before(async () => {
    assert.ok(admin, 'firebase-admin não instalado: npm install --no-save firebase-admin@14.5.0');
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'rode via npm run test:cron (emulators:exec define as variáveis)');
    // projeto próprio: o node --test roda os arquivos em paralelo no mesmo emulator
    process.env.GCLOUD_PROJECT = 'demo-purge-test';

    admin.app.initializeApp({ projectId: 'demo-purge-test' });
    db = admin.firestore.getFirestore();
    auth = admin.auth.getAuth();

    for (const name of ['rooms', 'users', 'userLimits', 'config']) {
      await db.recursiveDelete(db.collection(name));
    }
    const existing = (await auth.listUsers()).users.map((user) => user.uid);
    if (existing.length > 0) await auth.deleteUsers(existing);

    await auth.createUser({ uid: 'keep1', email: 'dono@example.com' });
    await auth.createUser({ uid: 'u2', email: 'outro@example.com' });
    await auth.createUser({ uid: 'anon1' });

    await db.doc('rooms/r1').set({ title: 'TITULO-SECRETO', ownerId: 'keep1' });
    await db.doc('rooms/r1/rounds/rd1').set({ text: 'x' });
    await db.doc('rooms/r1/rounds/rd1/votes/u2').set({ value: '5' });
    await db.doc('rooms/r2').set({ title: 'outra', ownerId: 'u2' });

    await db.doc('users/keep1').set({ name: 'Dono' });
    await db.doc('users/keep1/rooms/r1').set({ roomId: 'r1' });
    await db.doc('users/u2').set({ name: 'Outro' });
    await db.doc('users/u2/rooms/r2').set({ roomId: 'r2' });
    await db.doc('users/ghost/rooms/r1').set({ roomId: 'r1' }); // sem doc de perfil, só a subcoleção

    await db.doc('userLimits/keep1').set({ unlimited: true });
    await db.doc('userLimits/u2').set({ maxMembers: 2 });
    await db.doc('config/limits').set({ maxMembers: 8 });
  });

  it('sem KEEP_EMAILS recusa (apagaria até a conta do dono)', async () => {
    const result = run(['--confirm'], { KEEP_EMAILS: '' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /KEEP_EMAILS ausente/);
    assert.equal((await db.collection('rooms').get()).size, 2);
  });

  it('KEEP_EMAILS sem nenhuma conta existente (e-mail errado) recusa e não apaga nada', async () => {
    const result = run(['--confirm'], { KEEP_EMAILS: 'digitei-errado@example.com' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Nenhum e-mail de KEEP_EMAILS tem conta/);
    assert.equal((await db.collection('rooms').get()).size, 2);
    assert.deepEqual(await uids(), ['anon1', 'keep1', 'u2']);
  });

  it('sem emulator opt-in recusa (variável de emulator esquecida no shell)', () => {
    const result = run(['--confirm'], { ALLOW_EMULATOR: '' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Variável de emulator definida/);
  });

  it('dry-run: conta e não apaga nada, sem vazar e-mail nem título', async () => {
    const result = run();

    assert.equal(result.status, 0, out(result));
    assert.match(out(result), /Salas a apagar: 2/);
    assert.match(out(result), /Contas do Auth a apagar: 2/);
    assert.match(out(result), /Dry-run: nada foi apagado/);
    assert.ok(!/dono@example|outro@example|TITULO-SECRETO/.test(out(result)));

    assert.equal((await db.collection('rooms').get()).size, 2);
    assert.deepEqual(await uids(), ['anon1', 'keep1', 'u2']);
    assert.equal(await exists('users/u2'), true);
  });

  it('--confirm: apaga salas e contas alheias, mantém a conta, o perfil e o userLimits do dono e o config/limits', async () => {
    const result = run(['--confirm']);

    assert.equal(result.status, 0, out(result));

    // todas as salas, com rounds e votos
    assert.equal((await db.collection('rooms').get()).size, 0);
    assert.equal((await db.collection('rooms/r1/rounds').get()).size, 0);

    // só a conta do dono sobra no Auth
    assert.deepEqual(await uids(), ['keep1']);

    // perfil do dono fica; o índice "minhas salas" dele (agora apontando pro nada) vai embora
    assert.equal(await exists('users/keep1'), true);
    assert.equal((await db.collection('users/keep1/rooms').get()).size, 0);
    // perfil e índice dos outros, inclusive o doc fantasma, somem
    assert.equal(await exists('users/u2'), false);
    assert.equal((await db.collection('users/u2/rooms').get()).size, 0);
    assert.equal((await db.collection('users/ghost/rooms').get()).size, 0);

    // userLimits do dono fica, o dos outros some; config/limits intocado
    assert.equal(await exists('userLimits/keep1'), true);
    assert.equal(await exists('userLimits/u2'), false);
    assert.equal(await exists('config/limits'), true);
  });

  it('rodar de novo é inofensivo', () => {
    const result = run(['--confirm']);

    assert.equal(result.status, 0, out(result));
    assert.match(out(result), /Salas a apagar: 0/);
    assert.match(out(result), /Contas do Auth a apagar: 0/);
  });
});
