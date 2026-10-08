import { DEFAULT_MAX_ACTIVE_ROOMS, DEFAULT_MAX_MEMBERS, UNLIMITED_MAX_MEMBERS, resolveLimits } from './limits.service';

describe('resolveLimits', () => {
  it('sem nenhum doc, usa os padrões', () => {
    expect(resolveLimits(undefined, undefined)).toEqual({
      maxActiveRooms: DEFAULT_MAX_ACTIVE_ROOMS,
      maxMembers: DEFAULT_MAX_MEMBERS,
      unlimited: false,
    });
  });

  it('config/limits sobrescreve o padrão', () => {
    expect(resolveLimits({ maxMembers: 4, maxActiveRooms: 2 }, undefined)).toEqual({
      maxActiveRooms: 2, maxMembers: 4, unlimited: false,
    });
  });

  it('userLimits vence config/limits, campo a campo', () => {
    const limits = resolveLimits({ maxMembers: 4, maxActiveRooms: 2 }, { maxMembers: 20 });
    expect(limits.maxMembers).toBe(20);
    expect(limits.maxActiveRooms).toBe(2);
  });

  it('unlimited ignora os números', () => {
    expect(resolveLimits({ maxMembers: 4, maxActiveRooms: 2 }, { unlimited: true, maxMembers: 2 })).toEqual({
      maxActiveRooms: Infinity, maxMembers: UNLIMITED_MAX_MEMBERS, unlimited: true,
    });
  });

  it('valor que não é inteiro (digitado errado no console) cai pro próximo nível, como nas rules', () => {
    expect(resolveLimits({ maxMembers: 4 }, { maxMembers: '10' }).maxMembers).toBe(4);
    expect(resolveLimits({ maxMembers: 4 }, { maxMembers: 7.5 }).maxMembers).toBe(4);
    expect(resolveLimits({ maxMembers: '4' }, { maxMembers: '10' }).maxMembers).toBe(DEFAULT_MAX_MEMBERS);
    expect(resolveLimits({ maxActiveRooms: 3 }, { maxActiveRooms: '9' }).maxActiveRooms).toBe(3);
  });
});
