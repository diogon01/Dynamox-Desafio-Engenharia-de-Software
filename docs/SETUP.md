# Execução local — estado atual

Já estão operacionais: a fundação do monorepo, o contrato de telemetria (SCP-04), a
**autenticação completa** (login com credencial fixa, JWT, guard global, sessão e logout),
o **CRUD autenticado de máquinas no backend**, a **listagem e o cadastro de máquinas no
frontend**, a **gestão de pontos de monitoramento e sensores** (criação, associação com a
regra Pump × TcAg/TcAs, tabela paginada de 5 e ordenável por qualquer coluna) e a ingestão
e leitura de séries temporais.

Ainda faltam partes do fluxo completo — edição e exclusão de máquinas na interface e
exclusão de séries. Ver "Pendências" no fim deste documento.

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
npm run test                  # 101 API + 69 web = 170 testes; exige o PostgreSQL no ar
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
| `POST` | `/api/monitoring-points` | Cria ponto de monitoramento (`machineId` + `name`) |
| `GET` | `/api/monitoring-points` | Lista paginada (5 por página) e ordenável por qualquer coluna |
| `POST` | `/api/monitoring-points/:id/sensor` | Associa um sensor (`serialNumber` + `model`) ao ponto |
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

### Convenções de pontos de monitoramento e sensores

- **Ponto**: pertence a uma máquina; o nome (trim, máx. 120) é único **por máquina**
  (`409 MONITORING_POINT_NAME_CONFLICT`); máquina inexistente é `404`.
- **Sensor**: identificador (`serialNumber`) único global (`409 SENSOR_SERIAL_CONFLICT`);
  modelo em `TcAg`/`TcAs`/`HF+` (`400 INVALID_SENSOR_MODEL`); cada ponto aceita no máximo
  um sensor (`409 MONITORING_POINT_SENSOR_CONFLICT`).
- **Regra Pump**: máquinas `Pump` recusam `TcAg`/`TcAs` na associação
  (`409 SENSOR_MODEL_NOT_ALLOWED`) **e** na transição de tipo: um `PATCH /machines/:id`
  que tornaria a máquina `Pump` com sensores proibidos é revertido com
  `409 MACHINE_TYPE_SENSOR_CONFLICT`. Os dois fluxos são serializados por lock na linha
  da máquina, então a regra vale mesmo sob concorrência.
- **Listagem**: `GET /api/monitoring-points?page=1&pageSize=5&sortBy=machineName&sortDir=asc`.
  A **interface usa sempre 5 por página**, como pede o enunciado; na API o `pageSize` é um
  parâmetro opcional (padrão 5, máximo 50) para testes e consumidores programáticos.
  Parâmetros desconhecidos na query são rejeitados com `400`, como no corpo.
  `sortBy` aceita `machineName`, `machineType`, `pointName` e `sensorModel`; a ordenação
  usa o vocabulário público exibido na tabela (ex.: `HF+` < `TcAg` < `TcAs`), com pontos
  sem sensor sempre ao final, e desempate determinístico por nome e id. A resposta traz
  `items`, `total`, `page`, `pageSize`, `sortBy` e `sortDir`.

### Ingestão de um ciclo

A rota é privada: reutilize o `TOKEN` obtido na seção **Autenticando pelo terminal**.

```bash
curl -X POST http://localhost:3000/api/telemetry-cycles \
  -H "Authorization: Bearer $TOKEN" \
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
apps/api     backend NestJS (autenticação, CRUD de máquinas, telemetria, health check)
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
- **CRUD autenticado de máquinas no backend**: criação e edição aceitando somente `Pump` e
  `Fan`, listagem determinística (ordenada por nome), exclusão, e os erros `400` (payload
  ou tipo inválido), `404` (máquina inexistente) e `409` (nome duplicado, garantido pelo
  índice único do PostgreSQL via Prisma). Coberto por testes e2e contra o banco real.
- **Listagem e cadastro de máquinas no frontend** (MAC-02): painel em Material UI 5 que
  carrega a lista pela API autenticada, com estados de carregamento, erro e lista vazia, e
  formulário de cadastro com seleção `Pump`/`Fan`, validação de nome antes do envio e
  exibição da mensagem real da API para nome duplicado.
- **Pontos de monitoramento e sensores** (MON-01…06): criação de pontos por máquina,
  associação de sensor com identificador único e modelo `TcAg`/`TcAs`/`HF+`, regra
  `Pump` × (`TcAg`, `TcAs`) aplicada na associação **e** na troca de tipo da máquina
  (com lock de linha contra corridas), tabela paginada de 5 em 5 e ordenável pelas quatro
  colunas do enunciado — tudo no backend e no frontend, coberto por e2e contra o banco
  real e testes de componente.
- Ingestão idempotente de telemetria e leitura de séries com métricas.

## Pendências para fechar o P0

- Edição e exclusão de máquinas na interface (MAC-03) — a API já expõe `PATCH` e `DELETE`.
- Exclusão de série temporal e das entidades relacionadas, junto com a recuperação
  completa (paginada) de uma série.
- README de entrega na raiz com decisões, pressupostos e limitações.
- Medição reproduzível de latência abaixo de 350 ms.

## Pendências específicas do bônus BON-06

O gêmeo digital (Blender, ROS, Gazebo, ROS bags e gateway) **continua bloqueado**, conforme
`docs/planning/BON-06_SENSOR_TWIN_IMPLEMENTATION_PLAN.md`. O gate exige a fundação P0
estável, e ela ainda está incompleta. O que esta fase liberou foi apenas a dependência de
contrato: `contracts/dynamox/` agora existe e está validado, e o TS-06 já aceita o mesmo
payload que o futuro gateway produzirá.
