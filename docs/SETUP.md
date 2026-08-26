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
cp .env.example .env          # a porta padrão do Postgres é 5433, para não colidir com uma instância local em 5432
npm install
npm run db:up                 # sobe o PostgreSQL 16 em container
npm run prisma:deploy         # aplica as migrações
npm run seed                  # dados de demonstração determinísticos
npm run build                 # Nx: libs -> api -> web
```

Em dois terminais:

```bash
npm run dev:api               # http://localhost:3000/api
npm run dev:web               # http://localhost:5173
```

## Verificações

```bash
npm run contracts:validate    # SCP-04: sintaxe, hash do snapshot, exemplo x schema
npm run lint
npm run typecheck
npm run test                  # exige o PostgreSQL no ar (testes de integração do TS-06)
```

## Credenciais de demonstração

O enunciado pede login com e-mail e senha fixos. O seed cria:

| Campo | Valor |
|---|---|
| E-mail | `analista@dynamox.local` |
| Senha | `Dynamox@2026` |

São valores públicos de demonstração, definidos em `.env.example`. A tela de login e a
proteção de rotas ainda não foram implementadas (próxima fase).

## API disponível nesta fase

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Estado da API e do banco (`200` saudável, `503` degradado) |
| `POST` | `/api/telemetry-cycles` | Ingestão idempotente de um ciclo de telemetria (TS-06) |
| `GET` | `/api/time-series` | Séries persistidas com máquina, ponto, sensor e contagem |
| `GET` | `/api/time-series/:id/samples` | Amostras ordenadas por instante (`?limit=`, padrão 500) |
| `GET` | `/api/time-series/:id/metrics` | `count`, mínimo, máximo, média, último valor e janela |

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

## Pendências para fechar o P0

- Autenticação com credencial fixa, logout e proteção de rotas.
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
