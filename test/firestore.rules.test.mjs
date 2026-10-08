// Testes das firestore.rules contra o emulator. Rodar com: npm run test:rules
// (emulators:exec sobe o Firestore Emulator, roda isto e derruba; exige Java no PATH).
import { readFileSync } from 'node:fs';
import { after, afterEach, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'scrum-truco-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterEach(() => env.clearFirestore());
after(() => env.cleanup());

// conta cadastrada (só ela cria sala); convidado é anônimo
const account = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();
const guest = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

function newRoom(ownerId, extra = {}) {
  return {
    title: 'Sala', ownerId, controllerId: ownerId, status: 'open', currentRoundId: null,
    members: { [ownerId]: { name: 'Dono', role: 'owner', status: 'approved' } },
    ...extra,
  };
}

function membersOf(count) {
  const members = { owner: { name: 'Dono', role: 'owner', status: 'approved' } };
  for (let i = 1; i < count; i++) {
    members[`m${i}`] = { name: `Pessoa ${i}`, role: 'member', status: 'approved' };
  }
  return members;
}

const joinAs = (db, uid) => updateDoc(doc(db, 'rooms', 'r1'), `members.${uid}`, {
  name: 'Visitante', role: 'member', status: 'pending', joinedAt: serverTimestamp(),
});

describe('criar sala (maxMembers)', () => {
  it('aceita maxMembers dentro do padrão (8)', async () => {
    await assertSucceeds(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: 8 })));
  });

  it('recusa maxMembers acima do padrão', async () => {
    await assertFails(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: 9 })));
  });

  it('aceita sala sem maxMembers (cliente antigo)', async () => {
    await assertSucceeds(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1')));
  });

  it('recusa maxMembers que não é inteiro', async () => {
    await assertFails(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: '8' })));
  });

  it('config/limits muda o teto global', async () => {
    await seed((db) => setDoc(doc(db, 'config', 'limits'), { maxMembers: 4 }));

    await assertFails(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: 5 })));
    await assertSucceeds(setDoc(doc(account('u1'), 'rooms', 'r2'), newRoom('u1', { maxMembers: 4 })));
  });

  it('userLimits do dono vence config/limits', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'config', 'limits'), { maxMembers: 4 });
      await setDoc(doc(db, 'userLimits', 'u1'), { maxMembers: 20 });
    });

    await assertSucceeds(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: 20 })));
    // outro usuário continua no teto global
    await assertFails(setDoc(doc(account('u2'), 'rooms', 'r2'), newRoom('u2', { maxMembers: 20 })));
  });

  it('valor digitado errado no console (string, decimal) é ignorado, não trava a criação', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'config', 'limits'), { maxMembers: 4 });
      await setDoc(doc(db, 'userLimits', 'u1'), { maxMembers: '10' });
      await setDoc(doc(db, 'userLimits', 'u2'), { maxMembers: 7.5 });
    });

    // cai pro config/limits (4), igual ao cliente
    await assertSucceeds(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: 4 })));
    await assertFails(setDoc(doc(account('u1'), 'rooms', 'r2'), newRoom('u1', { maxMembers: 5 })));
    await assertSucceeds(setDoc(doc(account('u2'), 'rooms', 'r3'), newRoom('u2', { maxMembers: 4 })));
  });

  it('conta unlimited cria sala de até 1000 pessoas, e só até isso', async () => {
    await seed((db) => setDoc(doc(db, 'userLimits', 'u1'), { unlimited: true }));

    await assertSucceeds(setDoc(doc(account('u1'), 'rooms', 'r1'), newRoom('u1', { maxMembers: 1000 })));
    await assertFails(setDoc(doc(account('u1'), 'rooms', 'r2'), newRoom('u1', { maxMembers: 1001 })));
  });

  it('convidado anônimo continua sem poder criar sala', async () => {
    await assertFails(setDoc(doc(guest('g1'), 'rooms', 'r1'), newRoom('g1', { maxMembers: 8 })));
  });
});

describe('pedir entrada (sala cheia)', () => {
  it('aceita com vaga sobrando', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8, members: membersOf(7) })));
    await assertSucceeds(joinAs(guest('g1'), 'g1'));
  });

  it('recusa quando members já chegou em maxMembers', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8, members: membersOf(8) })));
    await assertFails(joinAs(guest('g1'), 'g1'));
  });

  it('pendentes contam: 7 aprovados + 1 pendente = cheia', async () => {
    const members = membersOf(8);
    members.m7.status = 'pending';
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8, members })));
    await assertFails(joinAs(guest('g2'), 'g2'));
  });

  it('sala antiga sem maxMembers usa o padrão de 8', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'old'), newRoom('owner', { members: membersOf(8) })));
    await assertFails(updateDoc(doc(guest('g1'), 'rooms', 'old'), 'members.g1', {
      name: 'V', role: 'member', status: 'pending', joinedAt: serverTimestamp(),
    }));
  });

  it('sala criada com limite maior aceita além de 8', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 20, members: membersOf(8) })));
    await assertSucceeds(joinAs(guest('g1'), 'g1'));
  });

  it('dono aprova um pendente mesmo com a sala cheia (tamanho não muda)', async () => {
    const members = membersOf(8);
    members.m7.status = 'pending';
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8, members })));
    await assertSucceeds(updateDoc(doc(account('owner'), 'rooms', 'r1'), { 'members.m7.status': 'approved' }));
  });

  it('dono remove alguém e a vaga volta', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8, members: membersOf(8) })));
    await assertSucceeds(updateDoc(doc(account('owner'), 'rooms', 'r1'), { 'members.m7': deleteField() }));
    await assertSucceeds(joinAs(guest('g1'), 'g1'));
  });

  it('dono não infla members além do teto (nem adicionando aprovados direto)', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8, members: membersOf(7) })));
    const room = doc(account('owner'), 'rooms', 'r1');
    const extra = (uid) => ({ name: uid, role: 'member', status: 'approved' });

    await assertSucceeds(updateDoc(room, 'members.x1', extra('x1'))); // 7 -> 8: no teto
    await assertFails(updateDoc(room, 'members.x2', extra('x2'))); // 8 -> 9: estoura
  });

  it('sala antiga acima do teto pode encolher (dono remove), mas não crescer', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'old'), newRoom('owner', { members: membersOf(10) })));
    const room = doc(account('owner'), 'rooms', 'old');

    await assertSucceeds(updateDoc(room, { 'members.m9': deleteField() })); // 10 -> 9
    await assertFails(updateDoc(room, 'members.x1', { name: 'x', role: 'member', status: 'approved' })); // 9 -> 10
  });

  it('maxMembers não pode ser alterado depois (nem pelo dono)', async () => {
    await seed((db) => setDoc(doc(db, 'rooms', 'r1'), newRoom('owner', { maxMembers: 8 })));
    await assertFails(updateDoc(doc(account('owner'), 'rooms', 'r1'), { maxMembers: 1000 }));
  });
});

describe('docs de limite', () => {
  it('config/limits: logado lê, ninguém escreve', async () => {
    await seed((db) => setDoc(doc(db, 'config', 'limits'), { maxMembers: 8 }));
    await assertSucceeds(getDoc(doc(account('u1'), 'config', 'limits')));
    await assertFails(setDoc(doc(account('u1'), 'config', 'limits'), { maxMembers: 1000 }));
  });

  it('userLimits: só o próprio uid lê; ninguém escreve (nem o próprio)', async () => {
    await seed((db) => setDoc(doc(db, 'userLimits', 'u1'), { unlimited: true }));
    await assertSucceeds(getDoc(doc(account('u1'), 'userLimits', 'u1')));
    await assertFails(getDoc(doc(account('u2'), 'userLimits', 'u1')));
    await assertFails(setDoc(doc(account('u1'), 'userLimits', 'u1'), { unlimited: true }));
  });
});
