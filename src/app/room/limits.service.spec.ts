import { DEFAULT_MAX_MEMBERS, UNLIMITED_MAX_MEMBERS, resolveLimits } from './limits.service';

describe('resolveLimits', () => {
  it('sem nenhum doc, usa o padrão', () => {
    expect(resolveLimits(undefined, undefined)).toEqual({ maxMembers: DEFAULT_MAX_MEMBERS, unlimited: false });
  });

  it('config/limits sobrescreve o padrão', () => {
    expect(resolveLimits({ maxMembers: 4 }, undefined)).toEqual({ maxMembers: 4, unlimited: false });
  });

  it('userLimits vence config/limits', () => {
    expect(resolveLimits({ maxMembers: 4 }, { maxMembers: 20 }).maxMembers).toBe(20);
  });

  it('unlimited ignora os números', () => {
    expect(resolveLimits({ maxMembers: 4 }, { unlimited: true, maxMembers: 2 })).toEqual({
      maxMembers: UNLIMITED_MAX_MEMBERS, unlimited: true,
    });
  });

  it('valor que não é inteiro (digitado errado no console) cai pro próximo nível, como nas rules', () => {
    expect(resolveLimits({ maxMembers: 4 }, { maxMembers: '10' }).maxMembers).toBe(4);
    expect(resolveLimits({ maxMembers: 4 }, { maxMembers: 7.5 }).maxMembers).toBe(4);
    expect(resolveLimits({ maxMembers: '4' }, { maxMembers: '10' }).maxMembers).toBe(DEFAULT_MAX_MEMBERS);
  });
});
