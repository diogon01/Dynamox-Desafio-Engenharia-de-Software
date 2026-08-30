# Monitoramento de condição no dashboard

O painel operacional mostra, por ponto de monitoramento, um "estado". Este documento
explica de onde esse estado vem, o que ele significa e — principalmente — o que ele **não**
significa.

**Resposta curta:** toda a classificação é calculada **no cliente, em tempo de
renderização**, a partir de dados reais lidos da API. Não há lógica de condição no backend
e nada é persistido. Uma busca por `condition|attention|severity|classification` em
`apps/api` não retorna nenhuma ocorrência.

- Cálculo: [`apps/web/src/features/dashboard/dashboardAggregations.ts`](../../../apps/web/src/features/dashboard/dashboardAggregations.ts)
- Exibição: [`apps/web/src/components/dashboard/SensorConditionMatrix.tsx`](../../../apps/web/src/components/dashboard/SensorConditionMatrix.tsx)

Os rótulos terminam em "demonstrativo" de propósito: são uma leitura didática de dados
sintéticos, não um diagnóstico de condição de máquina.

## Dois eixos ortogonais

O que a tela chama de "estado" é, no código, **duas dimensões independentes** exibidas
juntas.

### 1. `condition` — o que a medição sugere

| Estado exibido | Regra no código | Depende de |
|---|---|---|
| Sem sensor | ponto sem sensor associado | inventário |
| Sem dados | sensor sem nenhuma amostra | série |
| Sem classificação | há amostras, mas não foi possível calcular baseline | amostras |
| Normal demonstrativo | `deviationRatio < 1,5` | amostras |
| Observação demonstrativa | `deviationRatio ≥ 1,5` (`SYNTHETIC_OBSERVATION_RATIO`) | amostras |
| Atenção demonstrativa | `deviationRatio ≥ 2,0` (`SYNTHETIC_ATTENTION_RATIO`) | amostras |

`deviationRatio` compara a leitura recente com uma baseline calculada da própria série. O
cálculo espelha o supervisor do sensor twin: pareia os eixos Y e Z pelo timestamp, obtém
`radialRms = sqrt((y² + z²)/2)`, agrupa as amostras em **janelas de aquisição** (separadas
por mais de cinco minutos) e divide a média da segunda janela pela da primeira. A diferença
é onde isso roda: lá, no supervisor; aqui, no navegador.

Duas salvaguardas do cálculo: só sensores com série `SIM-` entram (o restante fica "Sem
classificação" em vez de receber número inventado) e, quando há mais de um sensor, as duas
janelas usadas precisam ser **compartilhadas pela frota** — assim, um ciclo isolado de
desenvolvimento não vira baseline de todo mundo.

### 2. `freshness` — quão recente é a leitura

| Estado | Regra |
|---|---|
| Atual | última amostra dentro de 24 h (`STALE_AFTER_MS`) |
| Desatualizado | última amostra com mais de 24 h |
| Relógio divergente | timestamp no futuro além de 5 min de tolerância (`FUTURE_TOLERANCE_MS`) |
| Sem leitura | nenhuma amostra ou timestamp inválido |

Os dois eixos não se misturam no cálculo: um sensor pode estar "Normal demonstrativo" e
"Desatualizado" ao mesmo tempo, e isso é informação, não contradição.

## Visualização

- **`SensorConditionMatrix`** — máquinas nas linhas, pontos (DE/NDE) nas células, com
  condição, frescor, último valor e unidade.
- **`OperationalInsights`** — sinais de atenção ordenados por severidade
  (`high`/`medium`/`info`), cada um com a razão em texto: qual desvio, qual limiar, ou a
  ausência de sensor/leitura.
- **`TrendPanel`** (Recharts) — série ao longo de 24 h / 7 d / 30 d. Abaixo de um limite de
  pontos, plota amostra a amostra; acima, agrega em buckets e mostra a média.
- **`SeriesExplorer`** — série individual, com agregação temporal quando o volume exige.

**Lacuna não é zero.** Quando duas aquisições estão separadas por um intervalo maior que o
típico, é inserido um ponto com `value: null` — o gráfico interrompe a linha em vez de
ligar dois instantes distantes ou desenhar um vale artificial em zero. Nas visões
agregadas, bucket sem amostra permanece `null` pelo mesmo motivo.

## Consequências práticas (gaps)

- **Filtro de classificação não pode ser server-side hoje.** O servidor não conhece
  "Atenção demonstrativa": para filtrar por isso na API seria preciso mover o cálculo (ou
  materializá-lo) para o backend. Por isso os filtros server-side implementados são os que
  o domínio já sustenta — tipo de máquina, modelo de sensor, presença de sensor e busca
  textual ([`../02-api/backend-architecture.md`](../02-api/backend-architecture.md)).
- **Custo de leitura.** Classificar exige baixar métricas e amostras de todas as séries no
  cliente; não escala para uma planta grande.
- **Sem histórico.** Como nada é persistido, não existe "estava em atenção ontem".
- **O KPI "Sinais de atenção" mistura os dois eixos** (condição + ausência + recência), o
  que explica ele igualar o total de pontos quando as leituras estão fora da janela.
- **Os limiares 1,5 e 2,0 são didáticos**, calibrados contra o gerador sintético. Não são
  limites industriais nem derivados de norma — ver
  [`../05-simulation/simulation-vs-real.md`](../05-simulation/simulation-vs-real.md).

## Decisão em aberto

Antes de redesenhar a matriz é preciso decidir o **domínio**: "condição" vira conceito de
primeira classe (persistido, com histórico e filtrável na API) ou permanece uma leitura
derivada no cliente?

As duas opções são defensáveis. Persistir dá histórico, filtro server-side e alerta, ao
custo de versionar regra de classificação e migrar dados quando o limiar mudar. Manter
derivado mantém o backend livre de uma semântica ainda provisória.

O que **não** se deve fazer é transformar os rótulos atuais em schema sem essa decisão —
seria congelar em banco um vocabulário escolhido para uma demonstração. Por isso esta
página descreve o modelo e **não** propõe o redesenho: a decisão está registrada como
aberta, e é assim que ela deve permanecer até ser tomada. É também a razão de não existir
um ADR para "condição no cliente": não há decisão fechada a registrar.
