# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Projeto

Scrum Truco — app Angular 17 de planning poker: uma sala onde o time estima tamanho/peso de tarefas votando em sigilo e o controlador revela. Usa NgModules (não standalone — ver schematics em `angular.json`). Backend é Firebase (Auth + Firestore) via `@angular/fire`, sempre no plano gratuito (Spark). CI/deploy: um único workflow (`.github/workflows/deploy-pages.yml`). Em PRs e push no `master` ele roda checagem de tipos (app + specs), testes e `build:pages`; só no `master`, e só se tudo passar, publica no GitHub Pages — **não existe mais `docs/` versionado**. No `master` a config do Firebase vem do secret `FIREBASE_CONFIG`; em PRs/branches usa uma config de mentira (apiKey preenchida, porque o Auth lança `auth/invalid-api-key` se vier vazia; os testes não falam com o Firebase), então o CI funciona em forks e o secret nunca chega a código de PR. Sem VPS nem Cloud Functions (exigiria plano pago).

## Comandos

- `npm start` / `ng serve` — dev server em http://localhost:4200
- `ng build` — build com SSR/prerender em `dist/scrum-truco-app` (`browser/` + `server/`); serve pra checar o prerender, **não** pra publicar
- `npm run build:pages` — build sem SSR (target `pages`, `baseHref=/scrum-truco-app/`) em `dist/pages/browser`, com `404.html` copiado do `index.html`. O `404.html` é o que faz o link `/rooms/:id` funcionar: o Pages não conhece a rota, cai no 404 e o Angular assume. É o mesmo comando do CI. O target `pages` duplica as opções de `build` em `angular.json` (esta versão do Angular não deixa desligar `server` por configuração): ao mudar assets/styles/budgets num, espelhar no outro
- `npm run test:ci` — testes Karma/Jasmine headless (launcher `ChromeHeadlessCI` com `--no-sandbox`, definido em `karma.conf.js`); é o mesmo comando do CI. `ng test` abre o Chrome em modo watch. Um spec só: `npm run test:ci -- --include='**/x.spec.ts'`
- `npx tsc -p tsconfig.app.json --noEmit` — checagem de tipos rápida (o `ng build` só pega erro de template)
- `npm run emulators` — Firestore + Auth Emulator locais (exige Java no PATH)
- `npm run test:rules` — testes de `firestore.rules` (`test/firestore.rules.test.mjs`, `node --test` + `@firebase/rules-unit-testing`) dentro de `firebase emulators:exec`; exige Java e o CLI do Firebase. Roda só local, não está no CI (idem `npm run test:cron`, da faxina de salas). Ao mexer em rules, adicionar/rodar os casos aqui: o log do emulator mostra um "evaluation error" por caso negado (é a passada de pré-busca de `get`/`exists`); o que vale é o `false` final.
- `firebase deploy --only firestore:rules` — publica `firestore.rules` no projeto real (`.firebaserc`); pede `firebase login` prévio
- Não há script de lint.

## Arquitetura

**Auth** (`src/app/auth/`): `AuthService` envolve Firebase Auth. Cadastrado (e-mail/senha) tem perfil em `users/{uid}` (nome, empresa); convidado entra por Auth anônimo (`User.isGuest`). `currentUser$` é reativo; `getCurrentUser()` pega o primeiro valor. `AuthModalService` deixa a home abrir o modal de login/cadastro que vive no `NavComponent`.

**Modelo Firestore** (a fonte de verdade de permissão é `firestore.rules`, não a UI):
- `rooms/{id}`: `ownerId` (imutável), `controllerId` (só o dono troca), `status` open/closed, `currentRoundId`, `members{uid:{name,role,status pending|approved}}`
- `rooms/{id}/rounds/{rid}`: `text`, `pointingType` (snapshot da escala), `revealed` (só false→true), `voters{uid:true}` (só "já votou")
- `rooms/{id}/rounds/{rid}/votes/{uid}`: `{value}` — **um doc por voto porque rules não restringem por campo**; leitura só do autor até `revealed`
- `users/{uid}/rooms/{roomId}`: índice de "minhas salas", escrito só pelo próprio usuário
- `rooms/{id}.maxMembers`: teto de participantes (aprovados **e** pendentes) gravado na criação; imutável. Sem o campo = 8. Ver "Limites de uso".
- `config/limits` (global) e `userLimits/{uid}` (por usuário): docs **opcionais** de limite; o cliente só lê, quem escreve é o console/Admin SDK.

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

## Limites de uso

Spec e plano em fases: `specs/limites-e-limpeza.md` (parâmetros, cron v2, conta ilimitada e purge). **A pasta `specs/` está no `.gitignore`: o arquivo só existe na máquina do dono, não no repo** (se não estiver aí, o resumo abaixo é o que vale; peça pro dono recriar ou descrever). Estado: **fases 1 (pessoas por sala), 2 (teto de salas no cliente) e 3 (cron v2) feitas**; faltam a 4 (admin: `ADMIN_EMAILS` + script de purge) e a 5 (purge real, na véspera da divulgação).

- O padrão de pessoas (8) vive em `firestore.rules` (`defaultMaxMembers()`) e em `limits.service.ts` (`DEFAULT_MAX_MEMBERS`), mantidos em sincronia à mão. O padrão de salas ativas (5) vive só em `limits.service.ts` (e no cron, fase 3): não está nas rules. Precedência: `userLimits/{uid}` → `config/limits` → padrão; `unlimited: true` ignora os números (pessoas = 1000, mesmo valor nos dois lados). Só inteiro vale nos dois lados (valor digitado errado no console cai pro próximo nível). Nenhum doc existente = padrões, então apagar um doc não trava nada.
- **Pessoas por sala é garantido pelas rules**: a criação valida `maxMembers` ≤ limite efetivo do dono (campo opcional, pra cliente antigo); o pedido de entrada exige `members.size() < maxMembers`; o dono não infla `members` além do teto (sala antiga acima dele só pode encolher). Pendentes contam (também limitam o crescimento do doc). Aprovar não muda o tamanho.
- **Salas ativas por usuário não dá pra garantir nas rules** (rules não contam documentos): checagem no cliente + varredura do cron (que é quem realmente fecha o excedente). "Ativa" = sala **aberta que eu criei** (`ownerId == uid`, `status == 'open'`); sala em que só participo não conta. O dashboard (`room.component`) mostra "N de 5 salas ativas", trava "+ Nova sala" no limite e lista as salas abertas com "Encerrar"; `room-add` relê a contagem no envio (`RoomService.getOwnedOpenRooms`, que parte do índice `users/{uid}/rooms` porque `rooms` não lista). Conta `unlimited` não vê contador nem bloqueio. **No cliente o teto é consultivo**: duas abas criando ao mesmo tempo, ou escrita direta no Firestore, passam dele (o cliente só conta salas presentes no índice `users/{uid}/rooms`); a garantia vem do cron, que fecha o excedente na próxima execução (até ~3 h).
- Mudar limite sem deploy: editar `config/limits` ou `userLimits/{uid}` no console do Firestore (vale pra salas **novas**; `maxMembers` já gravado numa sala não muda). Override é por **uid**; e-mail do dono nunca vai em arquivo versionado (repo público).
- Deploy de rules que mudam o que o cliente escreve: publicar `firestore.rules` **antes** do merge (são retrocompatíveis), com `firebase deploy --only firestore:rules` rodado pelo dono.

## Encerramento automático (fase 2)

Duas verificações independentes, ambas em `RoomService` (constantes `HEARTBEAT_INTERVAL_MS`/`OWNER_GONE_TOLERANCE_MS`/`INACTIVITY_TOLERANCE_MS`/`DELETE_AFTER_CLOSE_MS`), decididas de verdade pelas rules (`isStale`, `isValidDeleteAt` em `firestore.rules`) comparando com o relógio do servidor — o cliente só tenta, nunca é a fonte de verdade:

- **Dono ausente**: `room-view` grava `ownerLastSeen` a cada 45s enquanto o dono vê a própria sala aberta (`startOwnerHeartbeat`). Qualquer aprovado, a cada 30s (`checkStale`), tenta encerrar se passou 2 min sem heartbeat.
- **Inatividade**: `lastActivityAt` é bumpado em toda ação real (entrar rodada, votar, revelar, trocar controlador, aprovar/remover membro). Sem nenhuma há 60 min, qualquer aprovado encerra — mesmo com o dono presente, de propósito: é sinal separado do heartbeat.
- **Limpeza**: ao encerrar (manual ou automático), grava `deleteAt = agora + 12h` (`DELETE_AFTER_CLOSE_MS`), ou `+ 1h` se a sala nunca teve rodada (`DELETE_AFTER_CLOSE_EMPTY_MS`, `retentionAfterClose`); as rules validam entre agora e +48h. **Não usa o TTL nativo do Firestore** — ele exige o plano pago Blaze só pra existir (mesmo sem gastar nada), e o dono quer ficar só no Spark. Em vez disso, `scripts/cleanup-rooms.mjs` roda de 3 em 3 horas via `.github/workflows/cleanup-rooms.yml` (cron do GitHub Actions, grátis e ilimitado em repo público), com uma conta de serviço (secret `FIREBASE_SERVICE_ACCOUNT`, ver README) que ignora `firestore.rules` e apaga direto: sala + `rounds`/`votes` (recursiveDelete) + a entrada de cada participante em `users/{uid}/rooms`. O prazo real é o `deleteAt` + até 3 h de intervalo (e o GitHub atrasa execuções sob carga). Precisa do índice composto `status`+`deleteAt` em `firestore.indexes.json` (já publicado).
- **Faxina de salas abertas** (mesmo script, depois de apagar as vencidas): uma leitura só das salas `open` (igualdade em um campo, sem índice novo) e `planClosures` (`scripts/cleanup-logic.mjs`, puro) decide o que fechar: **inativa** (60 min sem `lastActivityAt`, igual às rules), **idade** (24 h desde `createdAt`, mesmo com atividade) e **teto** (dono com mais salas abertas que o limite efetivo: fecha as menos ativas primeiro; `unlimited` fica de fora). O fechamento é uma transação que reavalia a decisão com o dado fresco (a sala pode ter ganhado atividade) e grava `deleteAt` como o cliente. O log só tem id e motivo (sem título nem dono: o log do Actions é público). Os valores de `cleanup-logic.mjs` espelham `room.service.ts`/`limits.service.ts` à mão. Testes: `npm run test:cron` (lógica pura + execução real do script contra o emulator; precisa de `npm install --no-save firebase-admin@14.5.0`, que não é dependência do projeto).

Isso resolve a antiga limitação das salas órfãs: se todo mundo desconectar, ninguém sobra pra observar o heartbeat e disparar o encerramento no cliente, mas a faxina fecha a sala por inatividade na execução seguinte (e ela libera a vaga do teto do dono).
