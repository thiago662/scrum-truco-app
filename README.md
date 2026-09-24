# ScrumTrucoApp

Planning poker em salas: o time vota em sigilo e o controlador revela. Angular 17 + Firebase (Auth e Firestore).

## Configuração (obrigatória antes de rodar)

O repositório não traz a config de nenhum projeto Firebase. Para rodar você precisa do **seu** projeto (o plano gratuito Spark basta):

1. No [Firebase Console](https://console.firebase.google.com), crie um projeto e um app da Web.
2. Em Authentication > Sign-in method, ative **E-mail/senha** e **Anônimo**. Crie o banco em Firestore Database.
3. Copie `src/environments/firebase.config.example.ts` para `src/environments/firebase.config.ts` e preencha com a config do app da Web.
4. Copie `.firebaserc.example` para `.firebaserc` com o ID do seu projeto e publique as regras: `firebase deploy --only firestore:rules`.

## Publicação (GitHub Pages via Actions)

O workflow `.github/workflows/deploy-pages.yml` roda checagem de tipos, testes (`npm run test:ci`) e build em todo PR para o `master`; a cada push no `master`, se tudo passar, ele publica o site. Configuração única no repositório:

1. Settings > Secrets and variables > Actions > **New repository secret**: nome `FIREBASE_CONFIG`, valor o objeto de config copiado do Console, com as chaves `{ ... }` (sem o `const firebaseConfig =`).
2. Settings > Pages > Build and deployment > Source: **GitHub Actions**.
3. Se o nome do repositório não for `scrum-truco-app`, ajuste `baseHref` no target `pages` do `angular.json`.

A config vai no JS publicado (é assim em qualquer app web Firebase); o secret só a mantém fora do código versionado. Para testar o build de publicação localmente: `npm run build:pages` (saída em `dist/pages/browser`).

`firebase.config.ts` e `.firebaserc` estão no `.gitignore`. A config do Firebase não é segredo (vai no JS do site), o que protege os dados são as regras do Firestore (`firestore.rules`) e a restrição da API key no Google Cloud Console.

Este projeto foi gerado com [Angular CLI](https://github.com/angular/angular-cli) versão 17.1.0.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
