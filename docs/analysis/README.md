# Comece aqui — Análise Sensor × API Dynamox (SCP-05)

Esta pasta responde a uma pergunta: **o que podemos afirmar com evidência sobre o domínio
da Dynamox para construir um sensor digital honesto?** Fizemos engenharia reversa do
snapshot público da API (versionado neste repositório) e separamos, frase a frase, o que é
fato, o que é cálculo nosso, o que é escolha nossa e o que ninguém sabe. O resultado é um
contrato analítico congelado e um blueprint de simulador — **nada de integração com a API
produtiva, nenhuma credencial, nenhum dado real**. Tudo aqui é reproduzível por comando e
auditável por hash.

## Os quatro conceitos em uma frase cada

- **API Dynamox** — a interface pública da plataforma DynaPredict; usamos apenas o
  *documento* que a descreve (snapshot OpenAPI 2.4.7), nunca a API em si.
- **Sensor digital** — um gerador determinístico que imita o *formato* dos dados de um
  sensor de vibração/temperatura (TcAg, TcAs, HF+), sem fingir ser o dispositivo real.
- **Normalização** — traduzir dados de origens diferentes (telemetria, métricas de
  waveform) para um único formato numérico rastreável, o `NormalizedMetric`, sem perder
  eixo, unidade, nulos nem origem.
- **Fuzzy** — o futuro motor de avaliação de condição (normal/atenção/crítico); ainda não
  existe e só consumirá métricas normalizadas.

## Ordem recomendada de leitura

1. [Walkthrough visual da P-101](./dynamox-p101-visual-walkthrough.md) — veja o sistema
   funcionando num exemplo concreto antes da teoria.
2. [Mapa mental](./dynamox-digital-sensor-map.md) — a paisagem inteira num diagrama.
3. [Mapeamento Sensor × API](./dynamox-sensor-api-mapping.md) — o relatório principal:
   inventário, perfis, contrato analítico e a decisão.
4. [Blueprint do sensor digital](./dynamox-digital-sensor-blueprint.md) — como o simulador
   será construído (presets, cenários, seed, nulos).
5. [Auditoria de drift](./dynamox-contract-drift.md) — onde a especificação pública
   diverge de si mesma e onde nós divergimos dela de propósito.
6. [Inventário de endpoints](./dynamox-endpoint-inventory.json) — a evidência bruta,
   gerada por `npm run analysis:inventory`.
7. [Arquitetura de autenticação](./dynamox-authentication-architecture.md) — login fixo,
   JWT, guard global, sessão Redux e logout (AUT-01/02/03, implementados e testados).

## Confirmado × escolha nossa × ainda desconhecido

| Confirmado (no snapshot) | Escolha nossa (rotulada) | Ainda desconhecido |
| --- | --- | --- |
| 18 operações com paths exatos | Presets leves do MVP (TcAs 5040 Hz×4096; HF+ 26290 Hz×8192) | Banda útil real (Nyquist é só teto) |
| Taxas por perfil: TcAg/TcAs 2520·5040 Hz; HF+ 1143→131450 Hz | TcAg sem waveform no MVP (conflito Q9) | Domínios de `evaluator`, `band`, `statisticalProcessing` |
| Waveform raw/spectrum travados em `acceleration`/`g` | Booleano → `unsupported` (nunca vira 0/1) | Composição entre elementos de `conditions[]` |
| Nulabilidade: `unit`, `value.x/y/z`, eixos, `rpm` | Eixo desabilitado ⇒ `null` (regra determinística local) | Forma real da lista de waveforms |
| Severidade `no-alert/a1/a2` separada de `detected/notDetected/notEvaluated` | `NormalizedMetric` + `WaveformAcquisitionContext` | Autenticação (`securitySchemes` vazio) |
| Escrita `timestamp` × leitura `datetime` | Cadência de telemetria (1/min) | Qualquer limiar numérico de alarme |

## Estado atual da SCP-05

Análise executada e **revisada duas vezes por revisor factual independente**: a primeira
revisão reprovou (8 erros, todos corrigidos), a segunda aprovou com ressalvas médias (também
corrigidas). Decisão técnica: **GO COM RESTRIÇÕES** — o sensor digital pode ser construído
sobre o subconjunto rastreável, com toda hipótese rotulada. O status do cartão no Notion é
decisão do Diogo; os entregáveis estão prontos para revisão humana.

## Estado da autenticação (AUT-01 · AUT-02 · AUT-03)

**Implementada, revisada e em revisão humana** (27/08/2026). Login fixo com JWT próprio,
guard global protegendo todas as rotas privadas, sessão Redux com restauração via
`/auth/me`, logout completo e 401 centralizado. Duas rodadas de revisão externa: a
primeira apontou 4 achados (enumeração por latência, seed sem reset de senha, corrida na
restauração, formato de e-mail) e a segunda apontou 3 no ciclo de sessão (falha
transitória derrubando JWT válido, 401 atrasado apagando login novo, teste declarando
cobertura maior que a real) — **todos os 7 corrigidos e revalidados** (61 testes de API +
30 de web verdes). Detalhes em
[Arquitetura de autenticação](./dynamox-authentication-architecture.md).

## Próxima task recomendada (após aprovação)

Fechar os **P0 restantes**: `MAC-01` (CRUD de máquinas) e a cadeia `MON-01…06` (pontos,
sensores, regra `Pump × TcAg/TcAs`, lista paginada e ordenável). Só depois vem o núcleo do
sensor digital (`libs/sensor-sim`: tipos `NormalizedMetric`, `NormalizationResult` e
`WaveformAcquisitionContext`, gerador determinístico por seed com os presets congelados),
alimentando o `POST /api/telemetry-cycles` já existente — conforme o gate registrado no
board. Prazo do desafio: **31/08/2026**.
