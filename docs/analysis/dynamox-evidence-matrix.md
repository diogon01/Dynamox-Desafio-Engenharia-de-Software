# Matriz de rastreabilidade — requisito × código × teste × execução × Notion

> Auditoria de 29/08/2026 · HEAD `196d4dd` (branch `diogo-fragoso`, 28 commits ainda sem
> push — hashes citados como texto; permalinks só existem para commits ≤ `66aca5b`).
> Validação executada em 29/08 pós `npx nx reset`: **build/lint/typecheck verdes nos 6
> projetos; 323 testes convencionais (152 API + 82 web + 89 sensor twin); +17 integração
> da planta; +5 integração ROS** — e reproduzida em **clone limpo** com PostgreSQL novo
> (DEL-03). Board: [Dynamox — Desafio Full-Stack](https://app.notion.com/p/9538b41c3f9f4181a6ce45ac60c6870a).

Status usados: **ENTREGUE** (com evidência executada) · **DECISÃO** (não implementado por
decisão registrada) · **CORTADO/SUBSTITUÍDO** · **BACKLOG** (não iniciado, sem evidência).

## Escopo e fundação

| Req | Status real | Código | Testes | Evidência executada | Notion | Limitações |
| --- | --- | --- | --- | --- | --- | --- |
| SCP-01 priorização | ENTREGUE | board/planos | — | P0 completo antes do bônus; freeze respeitado | [SCP-01](https://app.notion.com/3c8c529d1ab5810c948dc27248cbfee2) | decisão de processo |
| SCP-02 ambiguidades | ENTREGUE | `README.md` (seção Pressupostos) | — | commit `1c660de` | [SCP-02](https://app.notion.com/3c8c529d1ab581baa57fc36b3ad514cd) | — |
| SCP-03 arquitetura | ENTREGUE | `README.md`, `docs/SETUP.md` | — | monorepo executável | [SCP-03](https://app.notion.com/3c8c529d1ab581b99879da12a5efa024) | — |
| SCP-04 contrato público | ENTREGUE | `contracts/dynamox/` | `npm run contracts:validate` | verde em 29/08 (workspace e clone) | [SCP-04](https://app.notion.com/3c8c529d1ab5810aae04e4c408607879) | snapshot ≠ API viva |
| SCP-05 análise sensor×API | ENTREGUE | `docs/analysis/*` | `npm run analysis:inventory` | 2 revisões factuais; GO com restrições | [SCP-05](https://app.notion.com/3c8c529d1ab58140846ef937d2f963cc) | blueprint é histórico (ver banner) |
| FND-01 fork/branch | ENTREGUE | — | — | [repositório](https://github.com/diogon01/Dynamox-Desafio-Engenharia-de-Software), branch `diogo-fragoso` | [FND-01](https://app.notion.com/3c8c529d1ab5816586dcc780d554ce08) | 28 commits ainda locais |
| FND-02 monorepo Nx | ENTREGUE | `nx.json`, `package.json`, `apps/*`, `libs/*` | bateria completa | 6 projetos verdes | [FND-02](https://app.notion.com/3c8c529d1ab5818680f3d87ac1511847) | — |
| FND-03 PostgreSQL+Prisma | ENTREGUE | `docker-compose.yml`, `prisma/` | e2e contra PG real | migrações do zero no clone (DEL-03) | [FND-03](https://app.notion.com/3c8c529d1ab581d58adbfacd00264295) | container_name fixo (colisão só em dev duplo) |
| FND-04 schema/seed | ENTREGUE | `prisma/schema.prisma`, `prisma/migrations/`, seed | e2e | seed idempotente reexecutado no clone | [FND-04](https://app.notion.com/3c8c529d1ab5813ba5e6ea9fb9e0c793) | — |
| FND-05 lint/format/CC | ENTREGUE | `eslint.config.mjs` etc. | `npm run lint` (zero warnings) | verde 29/08; Conventional Commits em 28/28 | [FND-05](https://app.notion.com/3c8c529d1ab581979fc4e75f056d1fd1) | — |

## Autenticação, máquinas, pontos e sensores

| Req | Status real | Código | Testes | Evidência executada | Notion | Limitações |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-01 login+JWT | ENTREGUE | `apps/api/src/auth/` | `apps/api/test/auth.e2e-spec.ts` | 401 sem token (smoke clone); commit `d923143` (pushado) | [AUT-01](https://app.notion.com/3c8c529d1ab581bba71cfe6bca8987bd) | credencial demo fixa por requisito |
| AUT-02 login Redux | ENTREGUE | `apps/web/src` (auth slice/thunk) | suíte web | login real na UI (28 e 29/08) | [AUT-02](https://app.notion.com/3c8c529d1ab581b88143fb167a9907d8) | — |
| AUT-03 rotas privadas+logout | ENTREGUE | idem | suíte web | rotas bloqueadas; Sair funcional | [AUT-03](https://app.notion.com/3c8c529d1ab58185afc2f7660870bb9d) | — |
| MAC-01 CRUD API | ENTREGUE | `apps/api/src/machines/` | `machines.e2e-spec.ts` + unit | smoke clone: 201/200/204/404; commit `104f94b` (pushado) | [MAC-01](https://app.notion.com/3c8c529d1ab581d790a9d206eaf6a048) | — |
| MAC-02 listar/criar UI | ENTREGUE | `apps/web/src` | suíte web | commit `66aca5b` (pushado) | [MAC-02](https://app.notion.com/3c8c529d1ab58124bdcec55115be9283) | — |
| MAC-03 editar/excluir UI | ENTREGUE | `apps/web/src` | suíte web | commit `eca6883` (local) | [MAC-03](https://app.notion.com/3c8c529d1ab58156a177f1fbc920fe7b) | — |
| MON-01..04 pontos+sensores+regra Pump | ENTREGUE | `apps/api/src/monitoring-points/` | `monitoring-points.e2e-spec.ts` (inclui corrida PATCH×associação) | commit `1c86473` (local); smoke clone TcAg→409, HF+→201 | [MON-04](https://app.notion.com/3c8c529d1ab581dab4f9f26be7aea386) | — |
| MON-05 paginação 5 | ENTREGUE | `monitoring-points.dto.ts` (`DEFAULT_PAGE_SIZE=5`) | e2e | UI 1–5/11–12 de 12 (screenshots no F9) | [MON-05](https://app.notion.com/3c8c529d1ab581dfb4e8f102abc5513f) | paginação é global do tenant |
| MON-06 ordenação | ENTREGUE | idem | e2e (4 colunas × 2 sentidos) | smoke clone `sortBy=machineName&sortDir=desc` | [MON-06](https://app.notion.com/3c8c529d1ab581fa9657ee9448260f49) | — |

## Frontend e séries temporais

| Req | Status real | Código | Testes | Evidência executada | Notion | Limitações |
| --- | --- | --- | --- | --- | --- | --- |
| FE-01 shell MUI | ENTREGUE | `apps/web/src` (AppShell) | suíte web | commit `172d841` (local); screenshots | [FE-01](https://app.notion.com/3c8c529d1ab5813a9d65cbfc281cf6fc) | — |
| FE-02 Redux padronizado | ENTREGUE | slices por domínio | suíte web | 82 testes verdes | [FE-02](https://app.notion.com/3c8c529d1ab581cc8e1bccf05deace0e) | — |
| FE-03 componentes reutilizáveis | ENTREGUE | `libs/ui` | suíte web | — | [FE-03](https://app.notion.com/3c8c529d1ab581f692b4e5c873f789eb) | — |
| FE-04 responsividade | ENTREGUE | shell (drawer mobile) | — | verificação manual registrada | [FE-04](https://app.notion.com/3c8c529d1ab581e8ab24d5209bb9cd1c) | sem teste automatizado de viewport |
| API-01 filtro global de exceções | DECISÃO | erros por módulo | e2e cobrem códigos | decisão 28/08: não é requisito; alternativa testada | [API-01](https://app.notion.com/3c8c529d1ab581ebada2d9a8c4bd7a4b) | não implementado como camada única |
| TS-01 modelo de séries | ENTREGUE | `prisma/schema.prisma` | e2e | índices/unicidade por migração | [TS-01](https://app.notion.com/3c8c529d1ab5811a8430c36ef071d1d9) | — |
| TS-02 ingestão idempotente | ENTREGUE | `apps/api/src/telemetry/` | `telemetry.e2e-spec.ts` | Idempotency-Key+fingerprint; 25+ ciclos do bônus | [TS-02](https://app.notion.com/3c8c529d1ab581e189ebccd6ce96bc4b) | — |
| TS-03 contagem/recuperação completa | ENTREGUE | idem | e2e varre série inteira | commit `6f26d9f` (local) | [TS-03](https://app.notion.com/3c8c529d1ab58138a4ddc03115c8fcc4) | — |
| TS-04 métricas | ENTREGUE | `GET /time-series/:id/metrics` | e2e | count/min/max/média/último | [TS-04](https://app.notion.com/3c8c529d1ab58158ab96d5acbd02fb30) | métricas descritivas, não diagnóstico |
| TS-05 exclusão | ENTREGUE | `DELETE /time-series/:id` | e2e | 204 + cascata | [TS-05](https://app.notion.com/3c8c529d1ab58145a580de832af98797) | — |
| TS-06 gráfico | ENTREGUE | Visão geral (Recharts) | suíte web | screenshots (seed e degrau 0,016→0,058 g) | [TS-06](https://app.notion.com/3c8c529d1ab58175b908f1ae74400664) | — |
| TS-07 < 350 ms | ENTREGUE | script de latência | `npm run perf:*` | commit `2f0ad7c` (local); pior caso ~34 ms (login/scrypt) | [TS-07](https://app.notion.com/3c8c529d1ab581a6aab0e76204ea0976) | medição local, não benchmark de produção |

## Qualidade, documentação e entrega

| Req | Status real | Código | Testes | Evidência executada | Notion | Limitações |
| --- | --- | --- | --- | --- | --- | --- |
| TST-01..03 backend | ENTREGUE | `apps/api/test/`, `apps/api/src/**/*.spec.ts` | 152 API | verdes 29/08 (workspace e clone) | [TST-01](https://app.notion.com/3c8c529d1ab581afbef9c5a11e6e4bc2) | — |
| TST-04 frontend | ENTREGUE | `apps/web/src/**` | 82 web | verdes 29/08 | [TST-04](https://app.notion.com/3c8c529d1ab581e1b607ff3f0aa03956) | — |
| TST-05 Cypress | BACKLOG | — | — | nenhum Cypress no repo | [TST-05](https://app.notion.com/3c8c529d1ab581868905f2fca1eca3f0) | fluxo coberto por Vitest+e2e |
| QLT-01 auditoria requisitos | ENTREGUE | — | — | auditoria como avaliador (28/08) + DEL-03 (29/08) | [QLT-01](https://app.notion.com/3c8c529d1ab581399352e686dbf47f62) | — |
| QLT-02 erros/UX | ENTREGUE | UI mostra erro real da API | suíte web | — | [QLT-02](https://app.notion.com/3c8c529d1ab581a5ac78eb1169cc5f5d) | — |
| DOC-01/02 README/arquitetura | ENTREGUE | `README.md`, `docs/SETUP.md` | — | commit `1c660de` (local); clone seguiu só o README | [DOC-01](https://app.notion.com/3c8c529d1ab581cf9c7fe972df762447) | — |
| DOC-03 registro de uso de IA | BACKLOG | — | — | não executado; decisão de conteúdo pertence ao autor | [DOC-03](https://app.notion.com/3c8c529d1ab581398503c608b3601fa4) | — |
| DEL-01 clone limpo | ENTREGUE | — | bateria no clone | 28/08 (HEAD `f33374f`) e 29/08 (PG novo 5434; achado real corrigido: `predev:api`, commit `1949b7c`) | [DEL-01](https://app.notion.com/3c8c529d1ab5811f89b9ebc37cec8fb6) | — |
| DEL-02 segredos/histórico | ENTREGUE | — | — | zero segredos; 28 commits do autor; zero marcas de IA nos commits | [DEL-02](https://app.notion.com/3c8c529d1ab58158ac25d323c0cc3a43) | — |
| DEL-03 PR readiness | ENTREGUE | — | — | rascunho completo de PR no cartão; veredito READY TO PUSH | [DEL-03](https://app.notion.com/3c8c529d1ab581959121f0af930183d9) | PR **não** aberto (aguardando ordem) |
| DEL-04 abrir PR | BACKLOG | — | — | bloqueado por ordem explícita (sem push/PR) | [DEL-04](https://app.notion.com/3c8c529d1ab581488ec6ed494bd1ca6b) | — |
| DEL-05 e-mail | BACKLOG | — | — | depende do PR | [DEL-05](https://app.notion.com/3c8c529d1ab581ee9ae0dd5b861098e8) | — |

## Bônus

| Req | Status real | Código | Testes | Evidência executada | Notion | Limitações |
| --- | --- | --- | --- | --- | --- | --- |
| BON-01 deploy demo | BACKLOG | — | — | — | [BON-01](https://app.notion.com/3c8c529d1ab5810b86f3df433695d78c) | — |
| BON-02 forecast | BACKLOG | — | — | registrado só como evolução futura (README do twin) | [BON-02](https://app.notion.com/3c8c529d1ab5812b99a3c3c4c1c4d608) | **não** implementado |
| BON-03 load test | BACKLOG | — | — | latência TS-07 **não** é load test | [BON-03](https://app.notion.com/3c8c529d1ab58120861eec9fbb31d7d3) | — |
| BON-04 load balancing | BACKLOG | — | — | — | [BON-04](https://app.notion.com/3c8c529d1ab581e9bb14d7ef011fe978) | — |
| BON-05 refatorar baseline | BACKLOG | — | — | não aplicável (implementação do zero) | [BON-05](https://app.notion.com/3c8c529d1ab581d8a35fc7ad4580eb29) | — |
| **BON-06** frota sintética | **ENTREGUE** | `simulation/sensor-twin/` | 89 unit + 17 integr. + 5 ROS | ver linhas F1–F9 | [BON-06](https://app.notion.com/3c8c529d1ab581e58639e2c2160a5b81) | *sombra digital* de estados simulados; **não** é gêmeo operacional bidirecional; threshold 2,0 didático; sem diagnóstico industrial |
| BON-06.1 Blender | CORTADO | — | — | decisão v3.1 | [06.1](https://app.notion.com/3c8c529d1ab581db914af00d5b7bbd99) | — |
| BON-06.2 Xacro/Gazebo | CORTADO | — | — | decisão v3.1 | [06.2](https://app.notion.com/3c8c529d1ab581a98c4cce39e752d0b3) | — |
| BON-06.3 contrato ROS | SUBSTITUÍDO | `src/payload.ts`, `src/provenance.ts` | payload/provenance specs | B3 `1a504f5` + F8 | [06.3](https://app.notion.com/3c8c529d1ab581a685fbfb62d0b9d801) | sem publicação ao vivo |
| BON-06.4 nó determinístico | SUBSTITUÍDO | `src/{rng,signal,windows}.ts` | signal/purity specs | B2 `36e8a04` | [06.4](https://app.notion.com/3c8c529d1ab5818690baec0748bf965e) | engine TS, não rosnode |
| BON-06.5 bag+replay | SUBSTITUÍDO→F8 | — | — | ver F8 | [06.5](https://app.notion.com/3c8c529d1ab581ebae53e945ebc8e62b) | — |
| F1 manifest | ENTREGUE | `src/plant.ts` | `plant.spec.ts` (11 invariantes) | `9aa556a` | [F1](https://app.notion.com/3cbc529d1ab5811faba5e0f43ed3bad6) | — |
| F2 bootstrap via API | ENTREGUE | `src/bootstrap.ts` | `test/plant.integration.spec.ts` | `7881187`; created=0 na 2ª; clone: 5/10/10 | [F2](https://app.notion.com/3cbc529d1ab58159b699fd56e9b5a843) | ambientes com dados externos não suportados |
| F3 engine parametrizada | ENTREGUE | `src/payload.ts`, `src/fleet.ts` | payload/fleet specs | `070ee75`; fingerprints idênticos entre bancos | [F3](https://app.notion.com/3cbc529d1ab581cb9cf0d1d25bebec84) | — |
| F4 snapshots | ENTREGUE | `src/fleet.ts` | fleet spec + integração | `a2f482c`+`4fa0f45`; 7.200 dp; replay 100% dup | [F4](https://app.notion.com/3cbc529d1ab581bf87f3f90cee553aed) | — |
| F5 assessment | ENTREGUE | `src/assess.ts` | assess spec + boundary | `e00b9cf`+`4fa0f45`; 3,49× vs 1,00× | [F5](https://app.notion.com/3cbc529d1ab581abbbd5ccd6ba2d7387) | ranking ≠ diagnóstico |
| F6 deliberação | ENTREGUE | `src/deliberate.ts` | assess spec + integração | `5f4eeb8`+`4fa0f45`; SUSPECT→CONFIRMED_ATTENTION | [F6](https://app.notion.com/3cbc529d1ab58199aefaed39e5ed06ce) | — |
| F7 integração | ENTREGUE | `test/*.spec.ts` | 17 testes | verde 2× (29/08) | [F7](https://app.notion.com/3cbc529d1ab581408fc8fa5eeb37f7cc) | exige API viva |
| F8 proveniência ROS | ENTREGUE | `src/provenance.ts`, `ros/rosbag_bridge.py` | 9 unit + 5 `twin:ros` | `da62e05`; fingerprint idêntico; duplicate:true; 0 amostras novas | [F8](https://app.notion.com/3cbc529d1ab581a5801cd43dcfe206b4) | requer ROS Noetic (opcional) |
| F9 docs/demo | ENTREGUE | READMEs | — | `8a2f809`; demo executada; 3 screenshots no cartão | [F9](https://app.notion.com/3cbc529d1ab581cab0afe079a72eb182) | — |

## Observações da auditoria

- A propriedade **Evidência** do database é do tipo **URL** e vem sendo usada com texto
  longo; recomendação registrada (sem alteração de schema): migrar para `rich_text` ou
  manter o detalhe no corpo das páginas — o corpo estruturado ("Estado final /
  Evidências verificáveis") foi adicionado nesta auditoria.
- Nenhum checkbox de Gazebo/Blender/Xacro foi marcado como entregue; itens cortados estão
  registrados como decisão, com o plano antigo movido para a seção "Histórico" do BON-06.
