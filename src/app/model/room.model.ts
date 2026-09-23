export interface RoomMember {
    name: string;
    role: 'owner' | 'member';
    status: 'pending' | 'approved';
    joinedAt?: any;
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

    constructor(
        id?: string,
        title?: string
    ) {
        this.id = id;
        this.title = title;
    }
}
