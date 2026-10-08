// Decisões da faxina (scripts/cleanup-logic.mjs): puras, sem Firestore. Rodar com: npm run test:cron
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_ACTIVE_ROOMS, INACTIVITY_MS, RETENTION_EMPTY_MS, RETENTION_MS,
  effectiveMaxActiveRooms, isAbandoned, isPastLifetime, planClosures, reasonStillApplies, retentionMs, toMillis,
} from '../scripts/cleanup-logic.mjs';

// As constantes do cron espelham as do cliente à mão; este teste lê os .ts e falha se divergirem.
// (só avalia aritmética simples de constantes `export const X = 12 * 60 * 60_000;` do próprio repo)
function clientConstant(file, name) {
  const source = readFileSync(file, 'utf8');
  const match = source.match(new RegExp(`export const ${name} = ([0-9_ *]+);`));
  assert.ok(match, `${name} não encontrada em ${file} (o formato mudou? ajuste este teste)`);
  return Function(`return ${match[1].replace(/_/g, '')}`)();
}

describe('constantes do cron iguais às do cliente', () => {
  const roomService = 'src/app/room/room.service.ts';
  const limitsService = 'src/app/room/limits.service.ts';

  it('retenção depois de encerrar (com rodada e sem rodada)', () => {
    assert.equal(RETENTION_MS, clientConstant(roomService, 'DELETE_AFTER_CLOSE_MS'));
    assert.equal(RETENTION_EMPTY_MS, clientConstant(roomService, 'DELETE_AFTER_CLOSE_EMPTY_MS'));
  });

  it('inatividade (igual à tolerância do cliente, que espelha isStale das rules)', () => {
    assert.equal(INACTIVITY_MS, clientConstant(roomService, 'INACTIVITY_TOLERANCE_MS'));
  });

  it('padrão de salas ativas', () => {
    assert.equal(DEFAULT_MAX_ACTIVE_ROOMS, clientConstant(limitsService, 'DEFAULT_MAX_ACTIVE_ROOMS'));
  });
});

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

// sala aberta: parada há `idleMin` minutos, criada há `ageH` horas
const room = (id, { ownerId = 'o1', idleMin = 5, ageH = 1, ...extra } = {}) => ({
  id, ownerId, status: 'open',
  lastActivityAt: NOW - idleMin * MIN,
  createdAt: NOW - ageH * HOUR,
  ...extra,
});

const noLimits = { globalLimits: undefined, userLimitsByUid: {} };
const ids = (plan, reason) => plan.filter((p) => p.reason === reason).map((p) => p.id).sort();

describe('toMillis', () => {
  it('aceita Timestamp (toMillis), número e ignora o resto', () => {
    assert.equal(toMillis({ toMillis: () => 42 }), 42);
    assert.equal(toMillis(7), 7);
    assert.equal(toMillis(undefined), null);
    assert.equal(toMillis('x'), null);
  });
});

describe('effectiveMaxActiveRooms', () => {
  it('padrão 5 sem nenhum doc', () => {
    assert.equal(effectiveMaxActiveRooms('u', undefined, {}), DEFAULT_MAX_ACTIVE_ROOMS);
    assert.equal(DEFAULT_MAX_ACTIVE_ROOMS, 5);
  });

  it('config/limits sobrescreve o padrão; userLimits vence os dois', () => {
    assert.equal(effectiveMaxActiveRooms('u', { maxActiveRooms: 3 }, {}), 3);
    assert.equal(effectiveMaxActiveRooms('u', { maxActiveRooms: 3 }, { u: { maxActiveRooms: 9 } }), 9);
    assert.equal(effectiveMaxActiveRooms('u', { maxActiveRooms: 3 }, { outro: { maxActiveRooms: 9 } }), 3);
  });

  it('unlimited não tem teto, mesmo com número configurado', () => {
    assert.equal(effectiveMaxActiveRooms('u', { maxActiveRooms: 3 }, { u: { unlimited: true, maxActiveRooms: 1 } }), Infinity);
  });

  it('valor que não é inteiro (digitado errado no console) cai pro próximo nível', () => {
    assert.equal(effectiveMaxActiveRooms('u', { maxActiveRooms: 3 }, { u: { maxActiveRooms: '9' } }), 3);
    assert.equal(effectiveMaxActiveRooms('u', { maxActiveRooms: 2.5 }, { u: { maxActiveRooms: 7.5 } }), 5);
  });
});

describe('retentionMs', () => {
  it('12h se a sala teve rodada, 1h se nunca teve', () => {
    assert.equal(retentionMs({ currentRoundId: 'rd1' }), RETENTION_MS);
    assert.equal(retentionMs({ currentRoundId: null }), RETENTION_EMPTY_MS);
    assert.equal(retentionMs({}), RETENTION_EMPTY_MS);
    assert.equal(RETENTION_MS, 12 * HOUR);
    assert.equal(RETENTION_EMPTY_MS, HOUR);
  });
});

describe('isAbandoned / isPastLifetime', () => {
  it('abandonada passando de 60 min sem atividade, viva dentro disso', () => {
    assert.equal(isAbandoned(room('a', { idleMin: 61 }), NOW), true);
    assert.equal(isAbandoned(room('a', { idleMin: 59 }), NOW), false);
  });

  it('sem lastActivityAt usa createdAt', () => {
    assert.equal(isAbandoned({ createdAt: NOW - 2 * HOUR }, NOW), true);
    assert.equal(isAbandoned({ createdAt: NOW - 10 * MIN }, NOW), false);
  });

  it('sem nenhuma data não dá pra provar que está viva: abandonada', () => {
    assert.equal(isAbandoned({}, NOW), true);
  });

  it('velha demais passando de 24h desde a criação, mesmo ativa', () => {
    assert.equal(isPastLifetime(room('a', { ageH: 25 }), NOW), true);
    assert.equal(isPastLifetime(room('a', { ageH: 23 }), NOW), false);
    assert.equal(isPastLifetime({}, NOW), false);
  });
});

describe('planClosures', () => {
  it('fecha abandonadas e velhas, deixa as vivas', () => {
    const plan = planClosures([
      room('parada', { idleMin: 90 }),
      room('velha', { ageH: 30, idleMin: 1 }),
      room('viva', { idleMin: 5, ageH: 2 }),
    ], noLimits, NOW);

    assert.deepEqual(ids(plan, 'inativa'), ['parada']);
    assert.deepEqual(ids(plan, 'idade'), ['velha']);
    assert.equal(plan.length, 2);
  });

  it('sala parada e velha conta uma vez só (inativa)', () => {
    const plan = planClosures([room('x', { idleMin: 90, ageH: 30 })], noLimits, NOW);
    assert.deepEqual(plan, [{ id: 'x', reason: 'inativa' }]);
  });

  it('teto: acima de 5 abertas, fecha as menos ativas primeiro', () => {
    const open = [10, 20, 30, 40, 50, 55, 58].map((idleMin) => room(`s${idleMin}`, { idleMin }));
    const plan = planClosures(open, noLimits, NOW);

    // 7 abertas, limite 5: fecha as 2 mais paradas (58 e 55 min)
    assert.deepEqual(ids(plan, 'teto'), ['s55', 's58']);
    assert.equal(plan.length, 2);
  });

  it('exatamente no teto não fecha nada', () => {
    const open = [1, 2, 3, 4, 5].map((n) => room(`s${n}`, { idleMin: n }));
    assert.deepEqual(planClosures(open, noLimits, NOW), []);
  });

  it('o teto só conta o que sobrou: salas abandonadas já saem por inatividade', () => {
    const open = [
      ...[1, 2, 3, 4].map((n) => room(`viva${n}`, { idleMin: n })),
      room('parada1', { idleMin: 120 }),
      room('parada2', { idleMin: 150 }),
    ];
    const plan = planClosures(open, noLimits, NOW);

    assert.deepEqual(ids(plan, 'inativa'), ['parada1', 'parada2']);
    assert.deepEqual(ids(plan, 'teto'), []); // 4 vivas, abaixo de 5
  });

  it('o teto é por dono', () => {
    const open = [
      ...[1, 2, 3, 4, 5, 6].map((n) => room(`a${n}`, { ownerId: 'A', idleMin: n })),
      ...[1, 2, 3].map((n) => room(`b${n}`, { ownerId: 'B', idleMin: n })),
    ];
    assert.deepEqual(ids(planClosures(open, noLimits, NOW), 'teto'), ['a6']);
  });

  it('unlimited nunca é fechado pelo teto', () => {
    const open = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => room(`s${n}`, { ownerId: 'admin', idleMin: n }));
    const plan = planClosures(open, { globalLimits: undefined, userLimitsByUid: { admin: { unlimited: true } } }, NOW);
    assert.deepEqual(plan, []);
  });

  it('userLimits e config/limits mudam o teto', () => {
    const open = [1, 2, 3].map((n) => room(`s${n}`, { ownerId: 'u', idleMin: n }));

    assert.deepEqual(ids(planClosures(open, { globalLimits: { maxActiveRooms: 2 }, userLimitsByUid: {} }, NOW), 'teto'), ['s3']);
    assert.deepEqual(ids(planClosures(open, { globalLimits: { maxActiveRooms: 2 }, userLimitsByUid: { u: { maxActiveRooms: 1 } } }, NOW), 'teto'), ['s2', 's3']);
    assert.deepEqual(planClosures(open, { globalLimits: { maxActiveRooms: 2 }, userLimitsByUid: { u: { maxActiveRooms: 3 } } }, NOW), []);
  });

  it('sala sem dono fica de fora do teto', () => {
    // null (e não undefined, que acionaria o dono padrão do helper)
    const open = [1, 2, 3, 4, 5, 6].map((n) => room(`s${n}`, { ownerId: null, idleMin: n }));
    assert.deepEqual(planClosures(open, noLimits, NOW), []);
  });
});

describe('reasonStillApplies (reavaliação dentro da transação)', () => {
  it('sala que ganhou atividade nesse meio tempo não é mais inativa', () => {
    assert.equal(reasonStillApplies('inativa', room('a', { idleMin: 90 }), NOW), true);
    assert.equal(reasonStillApplies('inativa', room('a', { idleMin: 2 }), NOW), false);
  });

  it('sala já fechada nunca é fechada de novo', () => {
    assert.equal(reasonStillApplies('inativa', room('a', { idleMin: 90, status: 'closed' }), NOW), false);
    assert.equal(reasonStillApplies('teto', room('a', { status: 'closed' }), NOW), false);
  });

  it('idade e teto', () => {
    assert.equal(reasonStillApplies('idade', room('a', { ageH: 30 }), NOW), true);
    assert.equal(reasonStillApplies('idade', room('a', { ageH: 3 }), NOW), false);
    assert.equal(reasonStillApplies('teto', room('a'), NOW), true);
  });
});
