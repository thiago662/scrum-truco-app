export interface RoomMember {
    name: string;
    role: 'owner' | 'member';
    status: 'pending' | 'approved';
    joinedAt?: any;
}

// entrada do índice users/{uid}/rooms ("minhas salas")
export interface RoomIndexEntry {
    id: string;
    roomId: string;
    title: string;
}

export class Room {
    id?: string;
    title?: string;
    description?: string;
    ownerId?: string;
    controllerId?: string;
    status?: 'open' | 'closed';
    currentRoundId?: string | null;
    members?: { [uid: string]: RoomMember };
    // teto de participantes (aprovados + pendentes), gravado na criação a partir do limite do
    // dono; as rules recusam novos pedidos de entrada quando members.size() chega nele.
    // Sala sem o campo (anterior aos limites) usa DEFAULT_MAX_MEMBERS.
    maxMembers?: number;
    lastActivityAt?: any;
    ownerLastSeen?: any;
    createdAt?: any;
    // scripts/cleanup-rooms.mjs apaga a sala a partir desse instante (cron, não TTL nativo —
    // esse exigiria o plano pago Blaze); só é setado ao encerrar
    deleteAt?: any;

    constructor(
        id?: string,
        title?: string
    ) {
        this.id = id;
        this.title = title;
    }
}
