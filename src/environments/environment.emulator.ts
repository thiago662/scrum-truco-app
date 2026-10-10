// Ambiente dos emuladores (npm run start:emulator, com npm run emulators em outro terminal).
// A config é falsa e commitada de propósito: o projeto é "demo-*" e nada aqui fala com o Firebase
// real, então não há chave nem como acertar a produção por engano.
export const environment = {
    production: false,
    useEmulators: true,
    firebaseConfig: {
        apiKey: 'demo-api-key',
        authDomain: 'demo-scrum-truco.firebaseapp.com',
        projectId: 'demo-scrum-truco',
        appId: 'demo-app-id',
    },
};
