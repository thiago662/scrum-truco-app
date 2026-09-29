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
    lastActivityAt?: any;
    ownerLastSeen?: any;
    createdAt?: any;
    // TTL nativo do Firestore apaga a sala nesse instante, só é setado ao encerrar
    deleteAt?: any;

    constructor(
        id?: string,
        title?: string
    ) {
        this.id = id;
        this.title = title;
    }
}
