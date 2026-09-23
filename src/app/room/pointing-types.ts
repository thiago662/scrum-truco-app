import { PointingOption, PointingType } from '../model/pointing-type.model';

const opt = (label: string, weight: number | null): PointingOption => ({ label, weight });

export const POINTING_TYPES: PointingType[] = [
    {
        id: 'fibonacci',
        name: 'Fibonacci',
        options: [opt('?', null), opt('0', 0), opt('1', 1), opt('2', 2), opt('3', 3), opt('5', 5), opt('8', 8), opt('13', 13), opt('21', 21), opt('34', 34), opt('55', 55), opt('89', 89)],
    },
    {
        id: 'tshirt',
        name: 'Camisetas (PP a GG)',
        options: [opt('?', null), opt('PP', 1), opt('P', 2), opt('M', 3), opt('G', 5), opt('GG', 8)],
    },
    {
        id: 'powers-of-2',
        name: 'Potências de 2',
        options: [opt('?', null), opt('1', 1), opt('2', 2), opt('4', 4), opt('8', 8), opt('16', 16), opt('32', 32)],
    },
    {
        id: 'standard-poker',
        name: 'Planning poker clássico',
        options: [opt('?', null), opt('☕', null), opt('0', 0), opt('½', 0.5), opt('1', 1), opt('2', 2), opt('3', 3), opt('5', 5), opt('8', 8), opt('13', 13), opt('20', 20), opt('40', 40), opt('100', 100)],
    },
];

export function weightOf(label: string, options: PointingOption[]): number | null {
    return options.find((option) => option.label === label)?.weight ?? null;
}

export function averageWeight(weights: (number | null)[]): number | null {
    const numeric = weights.filter((weight): weight is number => weight != null);

    if (numeric.length === 0) {
        return null;
    }

    return numeric.reduce((sum, weight) => sum + weight, 0) / numeric.length;
}

// Empate de distância arredonda pra cima (10 entre 8 e 13 -> 13), o habitual em planning poker.
export function nearestOption(average: number, options: PointingOption[]): PointingOption | null {
    let best: PointingOption | null = null;

    for (const option of options) {
        if (option.weight == null) {
            continue;
        }

        const distance = Math.abs(option.weight - average);
        const bestDistance = best == null ? Infinity : Math.abs(best.weight! - average);

        if (distance < bestDistance || (distance === bestDistance && option.weight > best!.weight!)) {
            best = option;
        }
    }

    return best;
}
