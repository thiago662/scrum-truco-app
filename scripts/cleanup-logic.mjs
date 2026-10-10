// Decisões da faxina (scripts/cleanup-rooms.mjs), sem tocar no Firestore: recebe as salas abertas
// já lidas e devolve quais fechar e por quê. Separado do script pra ser testável com node --test.
// Valores espelham o cliente (room.service.ts: INACTIVITY_TOLERANCE_MS, DELETE_AFTER_CLOSE_MS,
// DELETE_AFTER_CLOSE_EMPTY_MS) e limits.service.ts (DEFAULT_MAX_ACTIVE_ROOMS); manter em sincronia à mão.

export const INACTIVITY_MS = 60 * 60_000;
export const MAX_OPEN_LIFETIME_MS = 24 * 60 * 60_000;
export const RETENTION_MS = 12 * 60 * 60_000;
// sala encerrada sem nenhuma rodada não tem nada pra rever: some logo
export const RETENTION_EMPTY_MS = 60 * 60_000;
export const DEFAULT_MAX_ACTIVE_ROOMS = 5;

// Timestamp do Admin SDK (toMillis) ou número (testes)
export function toMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return typeof value === 'number' ? value : null;
}

// só inteiro vale, como nas rules e no cliente: valor digitado errado no console cai pro próximo nível
const intOr = (value, fallback) => Number.isInteger(value) ? value : fallback;

// userLimits/{uid} → config/limits → padrão; `unlimited` não tem teto
export function effectiveMaxActiveRooms(uid, globalLimits, userLimitsByUid) {
  const user = userLimitsByUid[uid];

  if (user?.unlimited === true) {
    return Infinity;
  }

  return intOr(user?.maxActiveRooms, intOr(globalLimits?.maxActiveRooms, DEFAULT_MAX_ACTIVE_ROOMS));
}

export function retentionMs(room) {
  return room.currentRoundId ? RETENTION_MS : RETENTION_EMPTY_MS;
}

function lastActivityMs(room) {
  return toMillis(room.lastActivityAt) ?? toMillis(room.createdAt);
}

// sem nenhuma data (anterior ao controle de atividade) não há como provar que está viva
export function isAbandoned(room, nowMs) {
  const last = lastActivityMs(room);
  return last == null || nowMs - last > INACTIVITY_MS;
}

export function isPastLifetime(room, nowMs) {
  const created = toMillis(room.createdAt);
  return created != null && nowMs - created > MAX_OPEN_LIFETIME_MS;
}

// Reavalia a decisão com o dado fresco, dentro da transação de fechar: a sala pode ter recebido
// atividade (ou ter sido fechada) entre a leitura e a escrita. O teto não depende do dado da sala.
export function reasonStillApplies(reason, room, nowMs) {
  if (room.status !== 'open') return false;
  if (reason === 'inativa') return isAbandoned(room, nowMs);
  if (reason === 'idade') return isPastLifetime(room, nowMs);
  return true;
}

// openRooms: [{ id, ...dados }] só com status 'open'. Devolve [{ id, reason }], reason em
// 'inativa' | 'idade' | 'teto'. O teto só conta o que sobrou das outras regras e fecha primeiro
// as menos ativas de cada dono.
export function planClosures(openRooms, { globalLimits, userLimitsByUid }, nowMs) {
  const plan = [];
  const kept = [];

  for (const room of openRooms) {
    if (isAbandoned(room, nowMs)) {
      plan.push({ id: room.id, reason: 'inativa' });
    } else if (isPastLifetime(room, nowMs)) {
      plan.push({ id: room.id, reason: 'idade' });
    } else {
      kept.push(room);
    }
  }

  const byOwner = new Map();
  for (const room of kept) {
    if (room.ownerId == null) continue;
    byOwner.set(room.ownerId, [...(byOwner.get(room.ownerId) ?? []), room]);
  }

  for (const [ownerId, rooms] of byOwner) {
    const excess = rooms.length - effectiveMaxActiveRooms(ownerId, globalLimits, userLimitsByUid);

    if (excess > 0) {
      rooms
        .sort((a, b) => lastActivityMs(a) - lastActivityMs(b) || a.id.localeCompare(b.id))
        .slice(0, excess)
        .forEach((room) => plan.push({ id: room.id, reason: 'teto' }));
    }
  }

  return plan;
}
