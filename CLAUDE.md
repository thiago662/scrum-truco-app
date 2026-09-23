# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Projeto

Scrum Truco — app Angular 17 de planning poker: uma sala onde o time estima tamanho/peso de tarefas votando em sigilo e o controlador revela. Usa NgModules (não standalone — ver schematics em `angular.json`). Backend é Firebase (Auth + Firestore) via `@angular/fire`, sempre no plano gratuito (Spark). Deploy: build estático em `docs/` servido pelo GitHub Pages; sem VPS nem Cloud Functions (exigiria plano pago).

## Comandos

- `npm start` / `ng serve` — dev server em http://localhost:4200
- `ng build` — build de produção, saída em `docs/` (ver `outputPath` em `angular.json`) — **sobrescreve o site publicado**, use `--output-path=<pasta>` pra apenas verificar
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
- `src/environments/*.ts` guardam a config do Firebase (chave de client, não é segredo); o histórico mostra que o dono às vezes as deixa em branco no commit — não commitar mudanças nelas sem pedir.
- Convidado anônimo perde o acesso ao trocar de navegador/limpar dados (novo uid, volta a `pending`).

## Fora do escopo por enquanto

Encerramento automático da sala (dono desconectado via heartbeat em Firestore; inatividade via TTL nativo). O schema já tem `ownerLastSeen`/`lastActivityAt` reservados, sem lógica.
