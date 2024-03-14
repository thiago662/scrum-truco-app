import { Room } from "./room.model";

export class User {
    id?: string;
    name?: string;
    email?: string;
    password?: string;
    rooms?: Room[];

    constructor(
        id: string,
        name: string,
        email: string,
        password: string,
        rooms: Room[]
    ) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.rooms = rooms;
    }
}
