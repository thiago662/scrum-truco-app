import { POINTING_TYPES, averageWeight, nearestOption } from './pointing-types';

const type = (id: string) => POINTING_TYPES.find((t) => t.id === id)!;

describe('pointing-types', () => {
  it('averageWeight ignora pesos nulos e devolve null sem numéricos', () => {
    expect(averageWeight([3, 5, null, 8])).toBeCloseTo(5.333, 2);
    expect(averageWeight([null, null])).toBeNull();
    expect(averageWeight([])).toBeNull();
  });

  it('nearestOption pega o valor mais próximo da escala', () => {
    expect(nearestOption(6.4, type('fibonacci').options)?.label).toBe('5');
    expect(nearestOption(2.4, type('tshirt').options)?.label).toBe('P');
  });

  it('nearestOption arredonda empate pra cima', () => {
    expect(nearestOption(4, type('fibonacci').options)?.label).toBe('5');
    expect(nearestOption(10.5, type('fibonacci').options)?.label).toBe('13');
  });

  it('nearestOption ignora opções sem peso e devolve null se não houver nenhuma', () => {
    expect(nearestOption(1, [{ label: '?', weight: null }])).toBeNull();
    expect(nearestOption(100, type('fibonacci').options)?.label).toBe('89');
  });

  it('todo tipo pré-definido tem id único e ao menos 2 opções com peso', () => {
    const ids = POINTING_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    POINTING_TYPES.forEach((t) => expect(t.options.filter((o) => o.weight != null).length).toBeGreaterThanOrEqual(2));
  });
});
