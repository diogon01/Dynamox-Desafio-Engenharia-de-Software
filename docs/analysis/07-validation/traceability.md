# Rastreabilidade — requisito × código × verificação

Onde cada requisito do desafio vive no repositório e como confirmá-lo. Esta tabela é
**técnica e estável**: não traz status de tarefa, responsável, data, hash de commit nem
contagem de teste — isso é operação, e mora no board.

Itens puramente de processo (priorização, abertura de PR, envio da entrega, registro de uso
de IA) não aparecem aqui pelo mesmo motivo. Requisitos **não implementados** aparecem, com
o motivo, porque isso é informação técnica.

Comandos citados na coluna *Evidência* estão documentados em
[`docs/SETUP.md`](../../SETUP.md).

## Fundação e contratos

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| Pressupostos e ambiguidades registrados | `README.md` (seção de pressupostos) | — | leitura | decisões de escopo, não de código |
| Arquitetura documentada | `README.md`, `docs/SETUP.md`, `docs/analysis/` | — | esta base | — |
| Contrato público analisado e versionado | `contracts/dynamox/` | `apps/api/test/contract.spec.ts` | `npm run contracts:validate`; `sha256sum` do snapshot | snapshot ≠ API viva |
| Análise sensor × API | [`../04-contracts/`](../04-contracts/) | — | `npm run analysis:inventory` | análise de origem; `NormalizedMetric` não foi construído |
| Monorepo Nx com libs compartilhadas | `nx.json`, `apps/*`, `libs/*` | alvos `test` de cada projeto | `npm run build && npm run lint && npm run typecheck` | — |
| Histórico sintético de 30 dias pelo contrato | `simulation/sensor-twin/src/history/`, `tools/purge-history.ts` | `src/history/*.spec.ts`, `test/history.integration.spec.ts` | `npm run twin:history -- --dry-run`; reexecução → `duplicate` | dados e limiares didáticos; expõe bottlenecks do app (ver `testing-strategy.md`) |
| PostgreSQL + Prisma | `docker-compose.yml`, `prisma/` | e2e contra banco real | `npm run db:up && npm run prisma:deploy` | exige Docker local |
| Schema, migrações e seed idempotente | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` | e2e | `npm run seed` duas vezes | — |
| Lint, formatação e Conventional Commits | `eslint.config.mjs`, histórico | — | `npm run lint` (zero warnings) | — |

## Autenticação e acesso

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| Login com credencial fixa e JWT | `apps/api/src/auth/` | `apps/api/test/auth.e2e-spec.ts` | `/api/docs` → `POST /auth/login` | credencial de demonstração por requisito do enunciado |
| Sessão no frontend (Redux) | `apps/web/src/features/auth/` | `authSlice.spec.ts` | login pela UI | sem refresh token |
| Rotas privadas e logout | `apps/web/src/components/RequireAuth.tsx`, `AppShell.tsx` | `App.spec.tsx` | acesso direto a rota privada sem sessão | logout é client-side (JWT stateless) |
| Perfis ADMIN/VIEWER | `libs/domain`, `apps/api/src/auth/roles.guard.ts`, migração de `role` | `rbac-and-query.e2e-spec.ts` | login VIEWER → mutação → `403` | dois perfis apenas; sem administração de usuários |

## Máquinas, pontos e sensores

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| CRUD de máquinas na API | `apps/api/src/machines/` | `machines.e2e-spec.ts`, `machines.service.spec.ts`, `machines.dto.spec.ts` | `/api/docs` → seção *machines* | — |
| Listar, criar, editar e excluir máquinas na UI | `apps/web/src/pages/resources/` (`MachinesListPage`, `MachineFormPage`, `MachinePage`, `DeleteMachineDialog`), `features/machines/` | `machines-crud.spec.tsx`, `machinesSlice.spec.ts` | `/machines`, `/machines/new`, `/machines/:key/edit` | cada tela é uma rota; a exclusão mostra a cascata (pontos vão junto, sensores só se desassociam) antes do clique |
| Cadastro de ponto dentro da máquina | `apps/web/src/pages/resources/PointFormPage.tsx` | `machines-crud.spec.tsx` | `/machines/P-101/points/new` | a máquina vem da rota; o sensor é associado depois, na página do ponto |
| Associação de sensor pela página do ponto | `apps/web/src/pages/resources/AssignSensorDialog.tsx` | `machines-crud.spec.tsx` | botão "Associar sensor" em ponto sem sensor | oferece só os modelos compatíveis com o tipo da máquina; o backend continua sendo a barreira |
| Pontos de monitoramento e associação de sensor | `apps/api/src/monitoring-points/` | `monitoring-points.e2e-spec.ts` (+ corrida `PATCH` × associação) | `POST /monitoring-points/:id/sensor` | um sensor por ponto (índice único) |
| Regra `Pump` recusa `TcAg`/`TcAs` | `libs/domain`, `monitoring-points.service.ts`, `machines.service.ts` | e2e nos dois fluxos | associar `TcAg` em `Pump` → `409` | vale na associação **e** na troca de tipo |
| Paginação de 5 na tabela | `monitoring-points.dto.ts` (`DEFAULT_PAGE_SIZE`), painel | `rbac-and-query.e2e-spec.ts`, `MonitoringPointsPanel.spec.tsx` | tabela de pontos | paginação é global, não por máquina |
| Ordenação pelas colunas da tabela | `monitoring-points.service.ts` (`SORT_EXPRESSIONS`) | e2e nas quatro colunas, nos dois sentidos | `?sortBy=sensorModel&sortDir=desc` | ordena pelo rótulo público, não pelo enum interno |
| Busca e filtros server-side | `monitoring-points.dto.ts`, `buildListFilter` | e2e de busca, filtros e composição | `?search=&machineType=&hasSensor=` | o recorte por condição vive na camada analítica, não aqui |
| Recorte por condição (derivada) | `analytics.service.ts` (`machineList`, `fleetCondition`, `machineSummary`), `components/condition/ConditionFilter.tsx` | `analytics.e2e-spec.ts`, `machines-crud.spec.tsx` | `/machines?condition=attention` | condição não é coluna: o filtro é aplicado sobre a classificação, no servidor, e o vocabulário é o do domínio — não existe "crítico" |

## Frontend

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| Shell Material UI | `apps/web/src/components/AppShell.tsx`, `theme.ts` | `App.spec.tsx` | navegação lateral | — |
| Redux padronizado por domínio | `apps/web/src/features/*`, `store/` | specs dos slices | — | thunks, sem RTK Query ([ADR-0003](../06-decisions/adr-0003-redux-toolkit-thunks.md)) |
| Componentes reutilizáveis de estado | `libs/ui` | cobertos via `apps/web` | carregando/erro/vazio nas telas | sem suíte própria da lib |
| Responsividade | drawer temporário em telas pequenas | — | verificação manual | sem teste automatizado de viewport |
| Erros de API exibidos ao usuário | `api/client.ts`, painéis | specs de painel | nome duplicado → mensagem real da API | — |
| Painel operacional e gráfico | `components/dashboard/*`, `features/dashboard/*` | `OperationalDashboard.spec.tsx`, `dashboardAggregations.spec.ts` | painel inicial | classificação é derivada no cliente e demonstrativa |

## Telemetria e séries

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| Modelo de séries temporais | `prisma/schema.prisma` | e2e | migrações do zero | precisão de milissegundos por decisão de coluna |
| Ingestão idempotente | `apps/api/src/telemetry/`, `libs/contracts` | `telemetry.e2e-spec.ts` (matriz + concorrência) | repetir o ciclo → `200 duplicate:true` | chave viaja no header, não no payload |
| Recuperação completa da série | `getSamplesPage` (offset + `total`) | e2e varrendo a série inteira | `GET /time-series/:id/samples?limit&offset` | sem truncamento silencioso, por decisão |
| Métricas descritivas | `GET /time-series/:id/metrics` | e2e | `/api/docs` | são descritivas — não são diagnóstico |
| Exclusão de série | `DELETE /time-series/:id` | e2e | `204` + cascata das amostras | o ciclo de ingestão é preservado (auditoria) |
| Latência abaixo de 350 ms | `tools/measure-latency.ts` | — | `npm run perf:latency` | medição local em estado estacionário; não é teste de carga |
| Contrato publicado (OpenAPI) | `apps/api/src/openapi.ts`, `common/api-schemas.ts`, schema derivado | `openapi-contract.e2e-spec.ts`, `telemetry-schema-parity.e2e-spec.ts` | `/api/docs-json` | Swagger UI padrão, sem alternativas |

## Alertas

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| Política de condição única e versionada | `libs/domain/src/condition.ts` (`DEFAULT_CONDITION_POLICY` v1); API e web delegam | `apps/api/src/analytics/condition.spec.ts`, `dashboardAggregations.spec.ts` (fronteiras 1,4999/1,5/1,9999/2,0) | mesmo `3,49×` no painel antes e depois | condição continua derivada, por decisão ([ADR-0011](../06-decisions/adr-0011-condition-policy-and-alert-occurrences.md)) |
| Alerta como episódio persistido (A1/A2, ciclo de vida, ACK ortogonal) | `prisma/schema.prisma` (`alert_*`), `libs/domain/src/alerts.ts`, `apps/api/src/alerts/core/` | tabelas de casos em `core/*.spec.ts`; `test/alerts.e2e-spec.ts` (abre, escala o MESMO episódio, resolve, ACK, escalada limpa ACK) | `GET /api/alerts/:id` responde regra, evidência, transições | tipo descreve a regra, nunca a causa |
| Baseline aprendida por ponto (192 ciclos, mediana por hora UTC) | `core/baseline.ts`, `alert-engine.ts` (`establishBaseline`) | `baseline.spec.ts`, e2e (`learningCount`) | tabela de baselines em [`alert-validation.md`](./alert-validation.md) | presume máquina sadia no comissionamento; SIM-HF-003 tem janela degradada (fumaça de junho) |
| Idempotência exactly-once e dedup pelo banco | `alert_cycle_evidence` (PK ciclo), `alert_rule_evaluations` (`UNIQUE(cycleId, ruleId, policyVersion)`), `activeKey` única | e2e (reenvio → 0 avaliações; ciclo atrasado → `OUT_OF_ORDER`) | `npm run alerts:backfill` duas vezes → "avaliações novas: 0" | sem P2002 como fluxo de controle |
| Presença: sensor mudo e colapso de frota | `core/presence.ts`, `alert-engine.ts` (`sweepPresence`), timer em `alerts.service.ts` | `presence.spec.ts` (12/12, 1/12, 7/12 escalonados, sensor antigo preservado), e2e com relógio replayado | `FLEET_SILENT` nas paradas de domingo e no trip; `SENSOR_SILENT` em SIM-TCAS-001 | não distingue parada planejada de falha; timer nunca arma sob Jest |
| Motor não lê a verdade-terreno | `apps/api/src/alerts/leakage.spec.ts` (grep de `metadata\|configuration\|groundTruth\|scenario`) | o próprio teste | só `validate.cli.ts` lê o rótulo | — |
| Backfill e validação | `apps/api/src/alerts/backfill.cli.ts`, `validate.cli.ts` | — | `npm run alerts:backfill`, `npm run alerts:validate` → [`alert-validation.md`](./alert-validation.md) | validação depende do rótulo sintético; rodar com a API parada |
| API de alertas | `apps/api/src/alerts/alerts.controller.ts`, `alerts-query.service.ts` | `test/alerts.e2e-spec.ts` (filtros, interseção `from/to`, 401/403/404/400), `openapi-contract.e2e-spec.ts` | `/api/docs` → tag `alerts` | `from/to` é interseção com o período ativo, documentado |
| UI de alertas | `apps/web/src/pages/alerts/`, `components/alerts/`, seções em máquina/ponto/sensor, KPI e feed da home | `pages/alerts/alerts.spec.tsx`, `OperationalDashboard.spec.tsx` | `/alerts?status=active`, `/alerts/:id`, reconhecer como ADMIN | VIEWER não vê o botão de reconhecer (e a API responde 403) |

## Qualidade e bônus

| Requisito | Implementação | Testes | Evidência | Limitações |
|---|---|---|---|---|
| Testes de backend | `apps/api/test/`, `apps/api/src/**/*.spec.ts` | as próprias suítes | `npm run test` | e2e exigem PostgreSQL no ar |
| Testes de frontend | `apps/web/src/**/*.spec.ts(x)` | as próprias suítes | `npm run test` | jsdom, sem navegador real |
| Teste end-to-end com Cypress | **não implementado** | — | — | decisão: fluxo coberto por Vitest + e2e de API ([`testing-strategy.md`](./testing-strategy.md)) |
| Filtro global de exceções | **não implementado como camada única** | e2e cobrem os códigos | envelope `{code, message}` em toda a API | decisão: o formato já é único; ver [`../02-api/backend-architecture.md`](../02-api/backend-architecture.md) |
| Frota sintética / sensor twin | `simulation/sensor-twin/` | unitários + integração + round-trip ROS | `npm run plant -- baseline` | sombra digital de estados simulados; não é gêmeo operacional |
| Proveniência ROS | `ros/rosbag_bridge.py`, `src/provenance.ts` | `test-ros/ros.roundtrip.spec.ts` | `npm run plant -- rosbag` | exige ROS Noetic; opcional |
| Deploy demonstrativo, balanceamento, teste de carga | **não implementados** | — | — | fora do escopo executado; tudo roda localmente |
| Forecast / análise preditiva | **não implementado** | — | — | registrado apenas como evolução futura |
| Gazebo / Blender / Xacro | **não implementados** | — | — | cortados por escopo; ver [`../05-simulation/simulation-vs-real.md`](../05-simulation/simulation-vs-real.md) |
