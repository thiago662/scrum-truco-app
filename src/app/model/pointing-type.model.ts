export interface PointingOption {
    label: string;
    // null = não entra no cálculo da média (ex: "?", "☕")
    weight: number | null;
}

export interface PointingType {
    // null = tipo personalizado, existe só como snapshot dentro da rodada
    id: string | null;
    name: string;
    options: PointingOption[];
}
