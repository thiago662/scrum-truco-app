export class User {
    id?: string;
    name?: string;
    email?: string;
    companyName?: string;

    constructor(
        id?: string,
        name?: string,
        email?: string,
        companyName?: string,
    ) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.companyName = companyName;
    }
}
