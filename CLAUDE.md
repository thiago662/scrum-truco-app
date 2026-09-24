# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Projeto

Scrum Truco — app Angular 17 de planning poker: uma sala onde o time estima tamanho/peso de tarefas votando em sigilo e o controlador revela. Usa NgModules (não standalone — ver schematics em `angular.json`). Backend é Firebase (Auth + Firestore) via `@angular/fire`, sempre no plano gratuito (Spark). Deploy: GitHub Actions (`.github/workflows/deploy-pages.yml`) builda e publica no GitHub Pages a cada push no `master`; **não existe mais `docs/` versionado**. A config do Firebase entra no build pelo secret `FIREBASE_CONFIG` do repositório. Sem VPS nem Cloud Functions (exigiria plano pago).

## Comandos

- `npm start` / `ng serve` — dev server em http://localhost:4200
- `ng build` — build com SSR/prerender em `dist/scrum-truco-app` (`browser/` + `server/`); serve pra checar o prerender, **não** pra publicar
- `npm run build:pages` — build sem SSR (target `pages`, `baseHref=/scrum-truco-app/`) em `dist/pages/browser`, com `404.html` copiado do `index.html`. O `404.html` é o que faz o link `/rooms/:id` funcionar: o Pages não conhece a rota, cai no 404 e o Angular assume. É o mesmo comando do CI. O target `pages` duplica as opções de `build` em `angular.json` (esta versão do Angular não deixa desligar `server` por configuração): ao mudar assets/styles/budgets num, espelhar no outro
- `ng test --watch=false --browsers=ChromeHeadless` — testes Karma/Jasmine (`--include='**/x.spec.ts'` roda um só)
- `npx tsc -p tsconfig.app.json --noEmit` — checagem de tipos rápida (o `ng build` só pega erro de template)
- `npm run emulators` — Firestore + Auth Emulator locais (exige Java no PATH)
- `firebase deploy --only firestore:rules` — publica `firestore.rules` no projeto real (`.firebaserc`); pede `firebase login` prévio
- Não há script de lint.

## Arquitetura

**Auth** (`src/app/auth/`): `AuthService` envolve Firebase Auth. Cadastrado (e-mail/senha) tem perfil em `users/{uid}` (nome, empresa); convidado entra por Auth anônimo (`User.isGuest`). `currentUser$` é reativo; `getCurrentUser()` pega o primeiro valor. `AuthModalService` deixa a home abrir o modal de login/cadastro que vive no `NavComponent`.

**Modelo Firestore** (a fonte de verdade de permissão é `firestore.rules`, não a UI):
- `rooms/{id}`: `ownerId` (imutável), `controllerId` (só o dono troca), `status` open/closed, `currentRoundId`, `members{uid:{name,role,status pending|approved}}`
- `rooms/{id}/rounds/{rid}`: `text`, `pointingType` (snapshot da escala), `revealed` (só false→true), `voters{uid:true}` (só "já votou")
- `rooms/{id}/rounds/{rid}/votes/{uid}`: `{value}` — **um doc por voto porque rules não restringem por campo**; leitura só do autor até `revealed`
- `users/{uid}/rooms/{roomId}`: índice de "minhas salas", escrito só pelo próprio usuário

**Sala** (`src/app/room/`): `RoomService` (sala/membros), `RoundService` (rodada/votos), `room-view` orquestra listeners. Papéis: dono (aprova/remove, encerra, elege controlador), controlador (inicia/revela rodada), participante (vota). Convidado entra pelo link, fica `pending` até o dono aprovar.

**Pontuação** (`room/pointing-types.ts`): tipos pré-definidos como constante (não em coleção Firestore), cada opção com `weight` (null = fora da média). O voto guarda só o rótulo; o peso é **sempre recalculado** a partir de `round.pointingType` (nunca confiar em peso vindo do cliente). `averageWeight`/`nearestOption` calculam a média aproximada (empate arredonda pra cima).

## Armadilhas (já custaram tempo)

- **SSR/prerender trava o build**: `ng build` prerenderiza as rotas em Node; código que faz `await` em Firebase no `ngOnInit` nunca resolve lá. Componentes com Firebase devem guardar com `isPlatformBrowser(PLATFORM_ID)` (ver `room-view`).
- **`provide*()` do AngularFire vão em `providers`**, não em `imports` do `AppModule`.
- **Corrida na revelação**: `listenRound` usa `includeMetadataChanges` e `room-view` só assina os votos quando a rodada foi confirmada pelo servidor (`hasPendingWrites` false); `listenVotes` ignora snapshots `fromCache`. Senão o autor da revelação assina cedo e as rules negam.
- **Specs**: componentes/serviços com Firebase precisam de `provideFirebaseApp/provideFirestore/provideAuth` no TestBed (ver `auth.service.spec.ts`).
- **Config do Firebase fica fora do git**: a real está em `src/environments/firebase.config.ts` e `.firebaserc` (ambos no `.gitignore`, só existem na máquina do dono); os `environment*.ts` apenas importam dela, e há `*.example` em branco no repo. Sem `firebase.config.ts`, build e testes não compilam (ver README). Nunca colocar a config real em arquivo versionado nem commitar build (`dist/`, `docs/`), porque o JS gerado a embute. Ela não é segredo (vai no JS publicado), mas o dono quer o repo público sem apontar pro projeto dele; a apiKey antiga já está no histórico e a proteção real são regras + restrição da key no Google Cloud.
- Só conta cadastrada cria sala (regra `sign_in_provider != 'anonymous'`); convidado só entra/vota.
- Convidado anônimo perde o acesso ao trocar de navegador/limpar dados (novo uid, volta a `pending`).

## Fora do escopo por enquanto

Encerramento automático da sala (dono desconectado via heartbeat em Firestore; inatividade via TTL nativo). O schema já tem `ownerLastSeen`/`lastActivityAt` reservados, sem lógica.
