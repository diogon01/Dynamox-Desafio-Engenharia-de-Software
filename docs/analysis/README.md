# Comece aqui — Análises do desafio Dynamox

Esta pasta reúne a análise de domínio (SCP-05, era de planejamento) e a **rastreabilidade
da entrega real**. Estado do repositório na última auditoria (**29/08/2026**, HEAD
`196d4dd`, branch `diogo-fragoso`, 28 commits locais ainda sem push):

- **Entrega convencional completa**: autenticação JWT, CRUD de máquinas, pontos e
  sensores com regra Pump⇒HF+, paginação 5 e ordenação bidirecional, séries temporais
  idempotentes com métricas/exclusão/recuperação completa, gráfico, Swagger.
- **Validação executada** (pós `npx nx reset`): build/lint/typecheck verdes nos 6
  projetos; **323 testes convencionais** (152 API + 82 web + 89 sensor twin) **+ 17 de
  integração da planta + 5 de integração ROS**; latência pior caso ~34 ms (limite 350 ms).
- **Reprodução em clone limpo** (DEL-01/DEL-03): só conteúdo versionado + PostgreSQL
  novo → migrações do zero, seed, smoke completo de API e UI, bateria verde e bônus
  reproduzido com **fingerprints determinísticos idênticos entre bancos**.
- **Auditoria de segredos e histórico** (DEL-02): zero segredos versionados; `.env`
  nunca commitado; 28 commits todos do autor, Conventional Commits, sem marcas de IA.
- **Bônus BON-06** — terminologia honesta: *sensor twin determinístico com frota
  sintética e uma sombra digital dos estados simulados persistidos* (não é gêmeo digital
  operacional bidirecional). 6 máquinas / 12 pontos / 12 sensores; supervisor
  OBSERVE→RANK→ACT→RE-OBSERVE→RECOMMEND decidindo só por séries persistidas
  (P-101/NDE ≈3,49× vs ≈1,00×; SUSPECT→CONFIRMED_ATTENTION); proveniência ROS opcional
  com replay `duplicate:true`. Blender/Xacro/Gazebo cortados; **nenhum Fuzzy ou
  forecast implementado**; o core não depende do bônus.

## Rastreabilidade

➡️ **[Matriz de evidências requisito × código × teste × execução × Notion](./dynamox-evidence-matrix.md)** —
fonte única do estado de cada requisito (SCP, FND, AUT, MAC, MON, FE, API, TS, TST, QLT,
DOC, DEL, BON e BON-06.F1–F9), com limitações declaradas.

Guia do bônus: [`simulation/sensor-twin/README.md`](../../simulation/sensor-twin/README.md).
Guia operacional: [`docs/SETUP.md`](../SETUP.md). README de entrega: [`README.md`](../../README.md).

## Análise de domínio (SCP-05 — histórico vivo)

A análise abaixo foi feita **antes** da implementação e continua válida como registro de
engenharia reversa do snapshot público (nunca da API produtiva). Atenção: o simulador
descrito no blueprint evoluiu — **o que existe de verdade é `simulation/sensor-twin/`**
(ver banner em cada documento quando aplicável).

1. [Walkthrough visual da P-101](./dynamox-p101-visual-walkthrough.md) — o sistema num
   exemplo concreto.
2. [Mapa mental](./dynamox-digital-sensor-map.md) — a paisagem num diagrama.
3. [Mapeamento Sensor × API](./dynamox-sensor-api-mapping.md) — inventário, perfis,
   contrato analítico e decisão (GO com restrições, 2 revisões factuais).
4. [Blueprint do sensor digital](./dynamox-digital-sensor-blueprint.md) — plano da era
   SCP-05; **superado pela implementação real** (banner no topo).
5. [Auditoria de drift](./dynamox-contract-drift.md) — divergências da spec pública e as
   nossas, deliberadas.
6. [Inventário de endpoints](./dynamox-endpoint-inventory.json) — evidência bruta
   (`npm run analysis:inventory`).
7. [Arquitetura de autenticação](./dynamox-authentication-architecture.md) — AUT-01/02/03
   (números daquele documento são do ciclo de 27/08; estado atual na matriz).

## Conceitos em uma frase

- **API Dynamox** — usamos apenas o *documento* público (snapshot OpenAPI 2.4.7,
  versionado com hash), nunca a API em si; o simulador recusa domínios Dynamox por código.
- **Sensor twin** — gerador determinístico que imita o *formato* dos dados (TcAg, TcAs,
  HF+), sem fingir ser o dispositivo real; amplitudes pedagógicas, limiar 2,0 didático.
- **Normalização** — conceito da análise SCP-05; na implementação, o contrato interno de
  telemetria (`libs/contracts`) cumpre o papel de formato único validado por Ajv.
- **Fuzzy / forecast** — **não implementados**; registrados apenas como evolução futura.
