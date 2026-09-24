import { PointingType } from './pointing-type.model';

export interface Round {
    id?: string;
    text: string;
    // snapshot do tipo no momento em que a rodada começa
    pointingType: PointingType;
    startedAt?: any;
    startedBy: string;
    revealed: boolean;
    revealedAt?: any;
    revealedBy?: string | null;
    // só "já votou", sem o valor: o valor fica em votes/{uid}, protegido pelas rules até revelar
    voters: { [uid: string]: true };
}

export interface Vote {
    // rótulo escolhido; o peso é sempre recalculado a partir de round.pointingType
    value: string;
    votedAt?: any;
}
