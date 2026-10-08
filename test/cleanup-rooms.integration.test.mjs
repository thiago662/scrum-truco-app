// Roda scripts/cleanup-rooms.mjs de verdade contra o Firestore Emulator. Rodar com: npm run test:cron
// Exige firebase-admin (o workflow instala sem salvar no package.json):
//   npm install --no-save firebase-admin@14.5.0
import { spawnSync } from 'node:child_process';
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

let admin;
try {
  admin = {
    app: await import('firebase-admin/app'),
    firestore: await import('firebase-admin/firestore'),
  };
} catch {
  // falha alto no before (abaixo), em vez de pular: um test:cron verde sem rodar o script de
  // verdade daria falsa segurança
}

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('cleanup-rooms.mjs contra o emulator', () => {
  let db;
  let Timestamp;
  let output;
  let now;

  const ts = (ms) => Timestamp.fromMillis(ms);
  const room = (over = {}) => ({
    title: 'TITULO-SECRETO', ownerId: 'o1', status: 'open', currentRoundId: null,
    members: { [over.ownerId ?? 'o1']: { name: 'Dono', role: 'owner', status: 'approved' } },
    lastActivityAt: ts(now - 5 * MIN), createdAt: ts(now - HOUR),
    ...over,
  });
  const put = (id, over) => db.collection('rooms').doc(id).set(room(over));
  const get = async (id) => (await db.collection('rooms').doc(id).get());
  const run = (env = { CLEANUP_ALLOW_EMULATOR: '1' }) =>
    spawnSync(process.execPath, ['scripts/cleanup-rooms.mjs'], { env: { ...process.env, ...env }, encoding: 'utf8' });

  before(async () => {
    assert.ok(admin, 'firebase-admin não instalado: npm install --no-save firebase-admin@14.5.0');
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via npm run test:cron (emulators:exec define FIRESTORE_EMULATOR_HOST)');
    process.env.GCLOUD_PROJECT = 'demo-cleanup-test';

    admin.app.initializeApp({ projectId: 'demo-cleanup-test' });
    db = admin.firestore.getFirestore();
    Timestamp = admin.firestore.Timestamp;
    now = Date.now();

    for (const name of ['rooms', 'users', 'userLimits', 'config']) {
      await db.recursiveDelete(db.collection(name));
    }

    // abandonadas / velhas
    await put('stale', { lastActivityAt: ts(now - 2 * HOUR), currentRoundId: 'rd1' });
    await put('stale-empty', { lastActivityAt: ts(now - 2 * HOUR) });
    await put('fresh');
    await put('old-active', { createdAt: ts(now - 25 * HOUR), lastActivityAt: ts(now - MIN) });

    // teto padrão (5): o2 tem 7 salas vivas, idle 1..7 min
    for (let n = 1; n <= 7; n++) await put(`c${n}`, { ownerId: 'o2', lastActivityAt: ts(now - n * MIN) });

    // unlimited: o3 com 7 salas vivas
    await db.collection('userLimits').doc('o3').set({ unlimited: true });
    for (let n = 1; n <= 7; n++) await put(`u${n}`, { ownerId: 'o3', lastActivityAt: ts(now - n * MIN) });

    // teto customizado (2): o4 com 3 salas vivas
    await db.collection('userLimits').doc('o4').set({ maxActiveRooms: 2 });
    for (let n = 1; n <= 3; n++) await put(`l${n}`, { ownerId: 'o4', lastActivityAt: ts(now - n * MIN) });

    // encerradas: uma vencida (com rodada, voto e índice do participante), uma ainda no prazo
    await put('due', { status: 'closed', deleteAt: ts(now - HOUR), members: { m1: { name: 'M', role: 'member', status: 'approved' } } });
    await db.collection('rooms').doc('due').collection('rounds').doc('rd1').set({ text: 'x' });
    await db.collection('rooms').doc('due').collection('rounds').doc('rd1').collection('votes').doc('m1').set({ value: '5' });
    await db.collection('users').doc('m1').collection('rooms').doc('due').set({ roomId: 'due' });
    await put('not-due', { status: 'closed', deleteAt: ts(now + 3 * HOUR) });

    const result = run();
    output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
  });

  const status = async (id) => (await get(id)).data().status;
  const deleteInMs = async (id) => (await get(id)).data().deleteAt.toMillis() - Date.now();

  it('fecha a abandonada e agenda a exclusão (12h se teve rodada, 1h se não)', async () => {
    assert.equal(await status('stale'), 'closed');
    assert.ok(Math.abs(await deleteInMs('stale') - 12 * HOUR) < 2 * MIN);

    assert.equal(await status('stale-empty'), 'closed');
    assert.ok(Math.abs(await deleteInMs('stale-empty') - HOUR) < 2 * MIN);
  });

  it('fecha a sala velha mesmo com atividade recente; deixa a viva aberta', async () => {
    assert.equal(await status('old-active'), 'closed');
    assert.equal(await status('fresh'), 'open');
  });

  it('teto padrão: fecha as 2 menos ativas e mantém as 5 mais ativas', async () => {
    for (const n of [6, 7]) assert.equal(await status(`c${n}`), 'closed');
    for (const n of [1, 2, 3, 4, 5]) assert.equal(await status(`c${n}`), 'open');
  });

  it('conta unlimited não perde nenhuma sala', async () => {
    for (let n = 1; n <= 7; n++) assert.equal(await status(`u${n}`), 'open');
  });

  it('teto customizado em userLimits vale pro dono', async () => {
    assert.equal(await status('l3'), 'closed');
    assert.equal(await status('l1'), 'open');
    assert.equal(await status('l2'), 'open');
  });

  it('apaga a encerrada vencida com rounds, votos e índice do participante; mantém a que ainda está no prazo', async () => {
    assert.equal((await get('due')).exists, false);
    assert.equal((await db.collection('rooms').doc('due').collection('rounds').get()).size, 0);
    assert.equal((await db.collection('users').doc('m1').collection('rooms').doc('due').get()).exists, false);
    assert.equal((await get('not-due')).exists, true);
  });

  it('o log não vaza título nem dono (o log do Actions é público)', () => {
    assert.ok(!output.includes('TITULO-SECRETO'));
    assert.ok(!/\bo1\b|\bo2\b|\bo3\b|\bo4\b/.test(output));
    assert.match(output, /Fechada \(teto\): c6/);
  });

  it('FIRESTORE_EMULATOR_HOST esquecido no shell não faz a faxina rodar no emulator sem querer', () => {
    const result = run({ CLEANUP_ALLOW_EMULATOR: '' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /FIRESTORE_EMULATOR_HOST está definido/);
  });

  it('rodar de novo é inofensivo: nada mais a fechar além do que já foi', () => {
    const second = run();
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /Fechadas: 0 inativa\(s\), 0 velha\(s\), 0 acima do teto\./);
  });
});
