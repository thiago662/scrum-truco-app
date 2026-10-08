# Spec: limites de uso, limpeza e conta ilimitada

Objetivo: o app é gratuito, mas não pode ser livre demais. Limitar o uso por conta sem atrapalhar o uso diário, manter a base enxuta e permitir exceções (a conta do dono) sem deploy.

## Resumo da abordagem

| Limite | Onde é garantido | Por quê |
|---|---|---|
| Pessoas por sala | **Rules do Firestore** (garantia real) | A regra de "pedir entrada" já lê o doc da sala; basta comparar `members.size()` com `maxMembers` gravado nele. |
| Salas ativas por usuário | **Cliente (UX) + varredura do cron** | Rules não contam documentos de uma coleção. O cliente barra com mensagem clara; o cron fecha o excedente depois, mesmo que alguém burle o cliente. |
| Exclusão de salas | **Cron v2** | Fecha salas abertas abandonadas, aplica o teto de salas e apaga as encerradas. |
| Conta ilimitada | **Doc de override no Firestore** | Alterado no console, sem deploy. |

O teto de salas torna a limitação conhecida (sala aberta que ninguém observa nunca fecha) um problema real: uma sala fantasma ocuparia uma vaga do dono para sempre. Por isso o cron precisa varrer salas **abertas** abandonadas, não só apagar as encerradas.

## Parâmetros

| Parâmetro | Valor | Onde mora |
|---|---|---|
| Salas ativas por usuário | 5 | `config/limits` (fallback fixo em cliente/cron) |
| Pessoas por sala | 8 (dono + 7; **pendentes contam**) | `config/limits`, copiado pra `room.maxMembers` na criação |
| Fechar por inatividade | 60 min (já existe) | rules `isStale` |
| Dono ausente | 2 min (já existe) | rules `isStale` |
| Teto de vida de sala aberta | 24 h (novo) | cron |
| Retenção após encerrar | 12 h (era 24 h) | `DELETE_AFTER_CLOSE_MS` (cliente) |
| Retenção de encerrada **sem nenhuma rodada** | 1 h (opcional) | cliente, ao encerrar |
| Frequência do cron | a cada 3 h (era 1x/dia) | workflow |

A retenção efetiva é a retenção mais o intervalo do cron: com o cron diário, "12 h" viraria até ~36 h, então a frequência sobe junto.

Os pendentes contam nos 8 porque também limitam o crescimento do doc da sala (alguém com o link poderia inflar `members` com pedidos). A contrapartida: 8 pendentes de estranhos bloqueiam o time, mas o dono pode rejeitar. Dá pra refinar depois com um teto separado pra pendentes.

## Modelo de dados

- `rooms/{id}.maxMembers` (number, novo): limite efetivo do dono na criação. Sala sem o campo usa 8. Imutável (nenhuma regra de update o inclui).
- `config/limits` (doc opcional, global): `{ maxActiveRooms, maxMembers }`. Leitura para logados; escrita só por console/Admin SDK.
- `userLimits/{uid}` (doc opcional, por usuário): `{ unlimited?, maxActiveRooms?, maxMembers? }`. Só o próprio uid lê; ninguém escreve pelo cliente.
- Precedência: `userLimits` → `config/limits` → padrão fixo (5 salas / 8 pessoas). `unlimited: true` ignora os números (pessoas = 1000, sem teto de salas). Nenhum doc existente = padrões; apagar um doc sem querer não trava o app.

## Rules

1. **Criar sala:** se `maxMembers` vier no doc, tem que ser inteiro e ≤ limite efetivo do dono. Ausente = aceita (permite deploy das rules antes do cliente novo).
2. **Pedir entrada:** exige `resource.data.members.size() < resource.data.get('maxMembers', 8)`.
3. **Aprovar:** sem mudança (troca pendente→aprovado no mesmo lugar; o tamanho não muda).
4. `config/{doc}` e `userLimits/{uid}` conforme o modelo acima.

Validação: `npm run test:rules` (emulator + `node --test`).

## Cliente

- **Sala cheia:** na tela da sala, se `members.length >= maxMembers` e não sou membro, mostra "Sala cheia" no lugar do formulário de pedir entrada.
- **Teto de salas:** dashboard mostra "3 de 5 salas ativas". Em 5/5, "+ Nova sala" explica o motivo e lista as salas abertas com atalho pra encerrar; a tela de criar também barra. Conta só salas em que sou **dono** com `status == 'open'`.
- **Retenção:** `DELETE_AFTER_CLOSE_MS` = 12 h (rules aceitam deleteAt até 48 h). Opcional: 1 h se `currentRoundId == null` ao encerrar.
- Conta `unlimited`: sem contador nem bloqueio.

## Cron v2 (`scripts/cleanup-rooms.mjs`)

Cada execução, nesta ordem:
1. **Apagar** encerradas com `deleteAt` vencido (já existe).
2. **Fechar abandonadas:** abertas com `lastActivityAt` (ou `createdAt` se faltar) mais antigas que 60 min. Fecha e grava `deleteAt` como o cliente.
3. **Teto de vida:** abertas com mais de 24 h desde `createdAt` são fechadas.
4. **Aplicar o teto de salas:** agrupa as abertas por dono; se passar do limite efetivo (lê `userLimits`/`config`, pula `unlimited`), fecha as menos ativas até caber.

Cada passo precisa de índice composto em `firestore.indexes.json` (`firebase deploy --only firestore:indexes`). Logs sem título de sala nem e-mail (o workflow é público): só contagens e uid abreviado.

## Admin: conta ilimitada e alterar limites

- **Base (sem código):** console → Firestore → `userLimits/<uid da sua conta>` com `unlimited: true`. Limites globais: editar `config/limits`. Vale pra salas novas, sem deploy.
- **Por e-mail (opcional):** passo no cron lê o secret `ADMIN_EMAILS` (fora do repo, que é público), resolve cada e-mail pra uid e garante `userLimits/{uid}.unlimited = true`. Só concede; revogar = apagar o doc no console.
- O override é amarrado ao **uid**, não ao e-mail dentro das rules. Confira no console que o uid é da sua conta.

## Limpar a base

`scripts/purge-data.mjs` com a service account existente:
- **Dry-run por padrão** (só contagens); só apaga com `--confirm`.
- Apaga todas as salas (com rounds/votes), todos os `users/*/rooms`, e perfis + contas do Auth de quem **não** estiver em `KEEP_EMAILS` (secret). Inclui contas de teste e anônimos.
- Roda como `workflow_dispatch` manual ou local. **Quem roda é o dono** (deleção em produção).
- Deixar por último, na véspera da divulgação.

## Fases

Um PR por fase, mesmo fluxo de sempre.

- [x] **1. Limite de pessoas:** rules + `maxMembers` + "sala cheia" + `config`/`userLimits` + `test:rules`. Deploy das rules **antes** do merge (retrocompatíveis).
- [ ] **2. Teto de salas (cliente):** contador, bloqueio e atalho de encerrar.
- [ ] **3. Cron v2:** passos 2–4, frequência, retenção 12 h, índices.
- [ ] **4. Admin:** passo `ADMIN_EMAILS` + script de purge + passo a passo no README.
- [ ] **5. Purge real**, na véspera do post.

Critérios de aceite:
- O 9º pedido de entrada numa sala de 8 é negado pelas rules (teste no emulator).
- Dono `unlimited` entra além de 8 e cria a 6ª sala.
- Sala sem atividade por mais de 60 min fecha no cron e some depois da retenção.
- Um dono com 6 salas abertas fica com 5 após uma execução do cron.

## Riscos e limitações

- **Limites são por conta, e contas são grátis.** Quem quiser abusar cria várias contas: isto desestimula uso casual, não é proteção contra atacante. A proteção real continua sendo App Check e a restrição de referrer da API key (pendentes).
- **Corrida na criação:** duas abas criando a 6ª sala passam no cliente; o cron corrige em até 3 h.
- **GitHub desativa workflows agendados** em repositório público sem atividade por 60 dias. O cron agora faz parte do limite; vale um commit de vez em quando ou ficar de olho no e-mail de aviso do GitHub.
- **Cota do Spark:** o cron lê todas as salas abertas a cada execução. Com centenas de salas abertas são poucos milhares de leituras por dia (limite de 50 mil); rever se o uso crescer.
- Salas que já existem com mais de 8 membros continuam como estão; só bloqueia novos pedidos.
