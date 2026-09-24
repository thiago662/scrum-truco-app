export class User {
    id?: string;
    name?: string;
    email?: string;
    companyName?: string;
    isGuest?: boolean;

    constructor(
        id?: string,
        name?: string,
        email?: string,
        companyName?: string,
        isGuest?: boolean,
    ) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.companyName = companyName;
        this.isGuest = isGuest;
    }
}
