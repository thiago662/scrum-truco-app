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

## Faxina de salas

`.github/workflows/cleanup-rooms.yml` roda de 3 em 3 horas (e também sob demanda em Actions > Faxina de salas > Run workflow). É o substituto ao TTL nativo do Firestore, que exigiria o plano pago Blaze. A cada execução:

1. apaga salas encerradas com o prazo vencido (12 h depois de encerrar; 1 h se a sala nunca teve rodada);
2. fecha salas abertas abandonadas (60 min sem atividade), com mais de 24 h de vida, ou acima do teto de salas ativas do dono (5 por padrão; as menos ativas fecham primeiro). Contas com `unlimited` em `userLimits/{uid}` não têm teto.

O GitHub desativa workflows agendados em repositório público sem nenhuma atividade por 60 dias: como o teto de salas agora depende desta faxina, um commit de vez em quando (ou o e-mail de aviso do GitHub) evita que ela pare sem ninguém notar.

Testes: `npm run test:cron` (decisões + execução real dos scripts de faxina e purge contra os emuladores de Firestore e Auth; exige Java, o CLI do Firebase e `npm install --no-save firebase-admin@14.5.0`). Configuração única:

1. Firebase Console > ⚙️ Configurações do projeto > **Contas de serviço** > **Gerar nova chave privada** (baixa um `.json`).
2. Settings > Secrets and variables > Actions > **New repository secret**: nome `FIREBASE_SERVICE_ACCOUNT`, valor o conteúdo inteiro desse arquivo.

Essa credencial ignora `firestore.rules` — guarde-a só como secret, nunca commitada.

## Rodar localmente com emuladores (sem tocar na produção)

O dev server normal (`npm start`) fala com o Firebase real. Pra testar com segurança, use os emuladores de Firestore e Auth (exige Java):

1. Terminal 1: `npm run emulators` (Firestore em 8080, Auth em 9099, painel em http://localhost:4000).
2. Terminal 2: `npm run start:emulator` e abra http://localhost:4200. A config é falsa (`src/environments/environment.emulator.ts`, projeto `demo-scrum-truco`), então não há como atingir a produção. Cadastre contas à vontade; os dados somem quando os emuladores caem. As `firestore.rules` do repositório valem lá.
3. Mexer nos limites: painel do emulador (http://localhost:4000/firestore) > crie `config/limits` com `{ maxMembers: 2, maxActiveRooms: 2 }`, ou `userLimits/<uid>` com `{ unlimited: true }` (o uid aparece em Authentication).
4. Faxina e purge contra o emulador: `npm run local:cleanup`; `npm run local:purge` (dry-run) e `npm run local:purge -- --confirm`, com `KEEP_EMAILS` no ambiente (PowerShell: `$env:KEEP_EMAILS='voce@exemplo.com'; npm run local:purge`). Precisa de `npm install --no-save firebase-admin@14.5.0`. Esses scripts forçam o emulador: nunca usam credencial real.

Roteiro de conferência (foi assim que a verificação ponta a ponta foi feita):

- **Pessoas por sala:** com `maxMembers: 2`, crie uma sala; em uma janela anônima abra o link e peça entrada; em outra janela anônima o link mostra "Sala cheia (2/2)".
- **Teto de salas:** com `maxActiveRooms: 2` e 2 salas abertas, "Suas salas" mostra "2 de 2 salas ativas", trava "+ Nova sala" e lista as salas com "Encerrar"; encerrar uma libera o botão.
- **Conta ilimitada:** com `userLimits/<seu uid>` = `{ unlimited: true }`, o contador e o aviso somem.
- **Faxina:** no painel, mude `lastActivityAt` de uma sala aberta pra 2 horas atrás e rode `npm run local:cleanup`: a sala vira "encerrada" no app. Uma sala encerrada com `deleteAt` no passado é apagada.
- **Purge:** `npm run local:purge` mostra o que apagaria (contas anônimas incluídas); com `--confirm` só sobra a conta de `KEEP_EMAILS`.

## Limites de uso e conta ilimitada

Padrões: 5 salas ativas por conta e 8 pessoas por sala (aprovados + pendentes). Os dois são opcionais de sobrescrever, **no console do Firestore, sem deploy** (vale pra salas novas):

- `config/limits` (global): `{ maxActiveRooms: 5, maxMembers: 8 }`, qualquer um dos campos.
- `userLimits/{uid}` (por conta): `{ maxActiveRooms, maxMembers }` ou `{ unlimited: true }`. Vence o global. Só número inteiro vale; valor digitado errado é ignorado.

**Conta ilimitada por e-mail** (sem mexer no console): cadastre a conta no app com o e-mail, crie o secret `ADMIN_EMAILS` (e-mails separados por vírgula) em Settings > Secrets and variables > Actions e rode Actions > Faxina de salas > Run workflow (ou espere a próxima execução). Ela grava `userLimits/{uid}.unlimited = true` e só concede: pra revogar, apague o doc no console. Cadastre a conta **antes** de pôr o e-mail no secret: o app não verifica e-mail, e a conta é de quem cadastrou primeiro. Depois da primeira execução, confira no Firebase Console > Authentication que o uid que começa com o prefixo do log (`Conta ilimitada garantida: abc123…`) é o da sua conta. Um e-mail mal digitado no secret só gera um aviso no log, não derruba a faxina. O repositório é público, por isso o e-mail só vive no secret.

## Limpar a base antes de divulgar

Actions > **Limpar a base (manual)** > Run workflow. Precisa do secret `KEEP_EMAILS` (e-mails que **não** serão apagados, separados por vírgula; pode ser o mesmo valor de `ADMIN_EMAILS`).

1. Rode primeiro em `dry-run` (o padrão): o log mostra só contagens (salas, contas, perfis), sem e-mail nem título.
2. Conferindo os números, rode de novo com o modo `apagar`.

Apaga **todas** as salas (com rodadas e votos) e todas as contas do Auth, perfis e `userLimits` fora de `KEEP_EMAILS`; mantém o perfil e o `userLimits` das contas mantidas e o `config/limits`. Não tem volta, e não bloqueia ninguém: rode antes de divulgar, quando não há ninguém usando (quem criar sala ou conta durante a execução escapa dela). Se falhar no meio, rode de novo: é idempotente. O script recusa rodar sem `KEEP_EMAILS` ou se nenhum e-mail dela tiver conta (e-mail digitado errado). Localmente: `FIREBASE_SERVICE_ACCOUNT=... KEEP_EMAILS=... node scripts/purge-data.mjs [--confirm]`.

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
