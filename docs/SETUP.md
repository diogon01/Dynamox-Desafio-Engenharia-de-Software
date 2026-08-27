# Execução local — Fase 0 (fundação)

Estado atual: fundação do monorepo, contrato de telemetria (SCP-04) e primeira versão do
endpoint de ingestão (TS-06). Autenticação e os CRUDs completos ainda não existem — ver
"Pendências" no fim deste documento.

> Os dados deste projeto são **sintéticos e didáticos**. A aplicação nunca chama a API
> produtiva da Dynamox; o frontend recusa qualquer `VITE_API_BASE_URL` apontando para
> domínios `dynamox.solutions` ou `dynamox.net`.

## Pré-requisitos

- Node.js 20 ou superior (validado com 22.23.1)
- Docker com Compose v2
- npm 10

## Passo a passo

```bash
cp .env.example .env          # OBRIGATÓRIO: sem .env a API não sobe (falta JWT_SECRET)
npm install
npm run db:up                 # sobe o PostgreSQL 16 em container
npm run prisma:deploy         # aplica as migrações
npm run seed                  # usuário fixo + dados de demonstração determinísticos
npm run build                 # Nx: libs -> api -> web
```

Em dois terminais:

```bash
npm run dev:api               # http://localhost:3000/api
npm run dev:web               # http://localhost:5173
```

Abra <http://localhost:5173>, faça login com as credenciais da seção seguinte e o painel
de diagnóstico carrega a série temporal do seed.

### Variáveis de ambiente

Todas vivem no `.env` da raiz, criado a partir do `.env.example`. O `.env` real está no
`.gitignore` e **nunca é versionado**; só o `.env.example` entra no repositório.

| Variável | Obrigatória | Padrão local | Para que serve |
|---|---|---|---|
| `DATABASE_URL` | sim | `postgresql://dynamox:dynamox@localhost:5433/...` | conexão do Prisma |
| `JWT_SECRET` | **sim** | `dev-only-change-me` | assinatura do JWT. **A API recusa iniciar sem ela** (`JWT_SECRET não definido. Configure o .env antes de subir a API.`) |
| `JWT_EXPIRES_IN` | não | `8h` | validade do token; sem refresh token, a sessão dura exatamente isso |
| `API_PORT` | não | `3000` | porta da API |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | não | `dynamox` / `dynamox` / `dynamox_challenge` / `5433` | container do Compose. A porta é 5433 para não colidir com um PostgreSQL local em 5432 |
| `VITE_API_BASE_URL` | não | `http://localhost:3000/api` | base da API no frontend; domínios `dynamox.solutions`/`dynamox.net` são recusados por código |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | não | ver abaixo | credencial fixa criada pelo seed |

O valor `dev-only-change-me` é um placeholder de desenvolvimento — troque em qualquer
ambiente compartilhado.

## Verificações

```bash
npm run contracts:validate    # SCP-04: sintaxe, hash do snapshot, exemplo x schema
npm run lint
npm run typecheck
npm run test                  # 61 API + 30 web; exige o PostgreSQL no ar (testes de integração)
```

## Credenciais de demonstração

O enunciado pede login com e-mail e senha fixos. O seed cria o usuário abaixo (upsert por
e-mail: rodar o seed várias vezes não duplica o registro e **redefine a senha**, garantindo
que a credencial anunciada sempre funcione):

| Campo | Valor |
|---|---|
| E-mail | `analista@dynamox.local` |
| Senha | `Dynamox@2026` |

São valores públicos de demonstração, configuráveis por `SEED_USER_EMAIL` e
`SEED_USER_PASSWORD` no `.env`. A senha é gravada como `scrypt$salt$hash` — nunca em texto
puro — e a API jamais devolve o hash em resposta alguma.

## API disponível nesta fase

Rotas **públicas** (sem token):

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Estado da API e do banco (`200` saudável, `503` degradado). Público por ser o probe usado antes do login |
| `POST` | `/api/auth/login` | Recebe `{ email, password }` e devolve `{ token, user }`. `401` genérico para credencial inválida; `400` para payload malformado |

Rotas **privadas** — exigem `Authorization: Bearer <token>`. Um guard global protege tudo
que não esteja explicitamente marcado como público, então o backend é a autoridade da
proteção (o frontend apenas espelha):

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/auth/me` | Usuário da sessão, sem senha nem hash |
| `POST` | `/api/machines` | Cria máquina (`name` + `type` em `Pump`/`Fan`). `409` para nome duplicado |
| `GET` | `/api/machines` | Lista as máquinas, ordenadas por nome |
| `GET` | `/api/machines/:id` | Uma máquina; `404` se não existir |
| `PATCH` | `/api/machines/:id` | Altera `name` e/ou `type`; corpo vazio é `400` |
| `DELETE` | `/api/machines/:id` | Remove a máquina (`204`); `404` se não existir |
| `POST` | `/api/telemetry-cycles` | Ingestão idempotente de um ciclo de telemetria |
| `GET` | `/api/time-series` | Séries persistidas com máquina, ponto, sensor e contagem |
| `GET` | `/api/time-series/:id/samples` | Amostras ordenadas por instante (`?limit=`, padrão 500) |
| `GET` | `/api/time-series/:id/metrics` | `count`, mínimo, máximo, média, último valor e janela |

### Autenticando pelo terminal

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"analista@dynamox.local","password":"Dynamox@2026"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

curl -s http://localhost:3000/api/time-series -H "Authorization: Bearer $TOKEN"
```

Sem o header, qualquer rota privada responde `401`.

### Convenções do CRUD de máquinas

- **Nome**: normalizado por `trim`, obrigatório, no máximo 120 caracteres. A unicidade é a
  do índice do PostgreSQL — sensível a maiúsculas, e aplicada pelo banco (não por consulta
  prévia), de modo que duas requisições concorrentes não criam duplicata.
- **Tipo**: aceita exclusivamente `Pump` ou `Fan`; qualquer outro valor é `400`
  (`INVALID_MACHINE_TYPE`). A resposta sempre usa esse vocabulário público, nunca o enum
  interno do banco.
- **Propriedades desconhecidas** no corpo são rejeitadas com `400`, em vez de ignoradas.
- **Ordenação** da listagem: por `name` ascendente, para o resultado ser determinístico.
- **Exclusão**: remover uma máquina apaga em cascata seus pontos de monitoramento
  (política já declarada no schema); sensores associados são apenas desassociados, não
  apagados.

### Ingestão de um ciclo

```bash
curl -X POST http://localhost:3000/api/telemetry-cycles \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: minha-chave-001' \
  --data @contracts/dynamox/examples/telemetry-cycle.example.json
```

### Como a idempotência funciona

A chave viaja no header, e não no corpo, porque `telemetryCycleData` declara
`additionalProperties: false`: acrescentar um campo ali invalidaria o payload.

O backend separa **intenção** de **conteúdo**. A `Idempotency-Key` expressa a intenção do
cliente; o `payloadFingerprint` — SHA-256 canônico sobre o ciclo inteiro, incluindo cada
par `timestamp`/`value` — identifica o conteúdo. Ambos têm restrição única.

| Requisição | Resposta |
|---|---|
| Chave conhecida + mesmo fingerprint | `200` `duplicate:true`, resultado original |
| Chave conhecida + fingerprint diferente | `409 IDEMPOTENCY_KEY_REUSED` |
| Chave nova + fingerprint conhecido | `200` `duplicate:true`, sem novo ciclo |
| Conteúdo inédito | `201` |

Sem header, o próprio fingerprint vira a chave: reprocessar o mesmo lote é reconhecido
como repetição sem nenhuma configuração do cliente. Duas requisições idênticas simultâneas
resultam em um único ciclo — a perdedora recupera e devolve o mesmo resultado da vencedora.

### Erros previstos

| Status | Código | Situação |
|---|---|---|
| `400` | `CONTRACT_VIOLATION` | Payload fora do schema interno (com a lista de violações) |
| `400` | `INVALID_IDEMPOTENCY_KEY` | Header fora de 1–128 caracteres do conjunto seguro |
| `400` | `NON_CANONICAL_TIMESTAMP` | Instante fora de `YYYY-MM-DDTHH:mm:ss.SSSZ` |
| `404` | `SENSOR_NOT_FOUND` | `measuringSystemUniqueIdentifier` desconhecido |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Chave já usada para outro conteúdo |
| `409` | `SAMPLE_TIMESTAMP_CONFLICT` | Instante repetido no payload ou já gravado na série |
| `409` | `SERIES_UNIT_CONFLICT` | Unidade divergente da já registrada para a série |
| `422` | `QUANTITY_AXIS_MISMATCH` | Grandeza vetorial sem eixo, ou escalar com eixo |
| `422` | `RESOURCE_ID_MISMATCH` | `resourceId` não é o do ponto monitorado do sensor |
| `422` | `SENSOR_NOT_ASSOCIATED` | Sensor sem ponto de monitoramento |

Conflitos abortam a transação inteira: nenhum ciclo é criado e nenhuma amostra é gravada
pela metade. Amostras nunca são descartadas em silêncio — uma colisão de instante é sempre
um erro explícito, jamais uma gravação parcial.

## Estrutura

```
apps/api     backend NestJS (health, ingestão, leitura de séries)
apps/web     frontend React + Vite + Material UI 5 + Redux Toolkit
libs/domain  vocabulário e regras de domínio (isomórfico, sem dependência de Node)
libs/contracts  validação Ajv do contrato interno e derivação de identificadores
libs/ui      estados reutilizáveis de carregamento, erro e vazio
contracts/dynamox  SCP-04 (snapshot público + contrato interno + exemplo)
prisma       schema, migrações e seed
```

### Decisões de estrutura

- **Nx sobre npm workspaces.** Os projetos são pacotes npm e o Nx orquestra os alvos
  declarados nos `package.json` (`build`, `lint`, `typecheck`, `test`), com o grafo de
  dependências resolvido por `dependsOn: ["^build"]`. Isso evita geradores acoplados a
  plugins e mantém cada projeto executável isoladamente com `npm run -w`.
- **`prisma/` e `contracts/` na raiz.** São compartilhados entre API, seed, ferramentas e
  (na fase do BON-06) o gateway de simulação; deixá-los dentro de `apps/api` criaria uma
  dependência invertida.
- **Aliases de fonte apenas em ferramentas de bundle.** No build, `@dynamox/*` é resolvido
  pelo `node_modules` do workspace a partir do `dist` publicado. O Vite usa alias direto
  para o código-fonte, porque já compila TypeScript e assim dispensa o build das libs em
  desenvolvimento.

## Já implementado

- **Autenticação end-to-end**: login com credencial fixa, JWT emitido e validado pela
  própria API, guard global, `GET /auth/me`, sessão Redux restaurada após reload, logout e
  proteção das rotas privadas no frontend. Detalhes e decisões em
  [`docs/analysis/dynamox-authentication-architecture.md`](./analysis/dynamox-authentication-architecture.md).
- Ingestão idempotente de telemetria e leitura de séries com métricas.

## Pendências para fechar o P0

- CRUD de máquinas (`Pump` / `Fan`) integrado ponta a ponta.
- CRUD de pontos de monitoramento e associação de sensor, aplicando a regra
  `Pump` × (`TcAg`, `TcAs`) na API (a regra já existe e é testada em `libs/domain`).
- Lista paginada de 5 itens por página com ordenação por coluna.
- Exclusão de série temporal e das entidades relacionadas.
- Telas de gestão no frontend (hoje há apenas o painel de diagnóstico).
- README de entrega na raiz com decisões, pressupostos e limitações.
- Medição reproduzível de latência abaixo de 350 ms.

## Pendências específicas do bônus BON-06

O gêmeo digital (Blender, ROS, Gazebo, ROS bags e gateway) **continua bloqueado**, conforme
`docs/planning/BON-06_SENSOR_TWIN_IMPLEMENTATION_PLAN.md`. O gate exige a fundação P0
estável, e ela ainda está incompleta. O que esta fase liberou foi apenas a dependência de
contrato: `contracts/dynamox/` agora existe e está validado, e o TS-06 já aceita o mesmo
payload que o futuro gateway produzirá.
