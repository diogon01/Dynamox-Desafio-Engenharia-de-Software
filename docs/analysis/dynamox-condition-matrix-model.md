# Matriz de Condição — modelo encontrado (auditoria de 30/08/2026)

> Levantamento do que a matriz **realmente** faz hoje, antes de qualquer redesenho. Não
> houve mudança de comportamento nesta etapa: este documento existe para que a semântica
> seja decidida com base no domínio, e não a partir dos rótulos que aparecem na tela.

## Resposta curta

Toda a classificação é **calculada no cliente, em tempo de renderização**, a partir de
dados reais lidos da API. **Não há lógica de condição no backend e nada é persistido.**

- Origem: `apps/web/src/features/dashboard/dashboardAggregations.ts`
- Consumo: `apps/web/src/components/dashboard/SensorConditionMatrix.tsx`
- Busca no backend por `condition|attention|severity|classification`: **nenhuma ocorrência**

Os rótulos terminam em "demonstrativo" de propósito: são uma leitura didática de dados
sintéticos, não um diagnóstico de condição de máquina.

## Duas dimensões independentes, exibidas juntas

O que a tela chama de "estado" é, no código, **dois eixos ortogonais**:

### 1. `condition` — o que a medição sugere

| Estado exibido | Regra no código | Depende de |
|---|---|---|
| Sem sensor | ponto sem sensor associado | inventário |
| Sem dados | sensor sem nenhuma amostra | série |
| Sem classificação | há amostras, mas não foi possível calcular baseline | amostras |
| Normal demonstrativo | `deviationRatio < 1,5` | amostras |
| Observação demonstrativa | `deviationRatio ≥ 1,5` (`SYNTHETIC_OBSERVATION_RATIO`) | amostras |
| Atenção demonstrativa | `deviationRatio ≥ 2,0` (`SYNTHETIC_ATTENTION_RATIO`) | amostras |

`deviationRatio` compara a leitura recente com uma baseline calculada da própria série —
mesma ideia do supervisor do BON-06, porém recomputada no navegador.

### 2. `freshness` — quão recente é a leitura

| Estado | Regra |
|---|---|
| Atual | última amostra dentro de 24 h (`STALE_AFTER_MS`) |
| Desatualizado | última amostra com mais de 24 h |
| Relógio divergente | timestamp no futuro além de 5 min de tolerância (`FUTURE_TOLERANCE_MS`) |
| Sem leitura | nenhuma amostra ou timestamp inválido |

## Respostas às perguntas do levantamento

1. **De onde cada estado vem?** De `buildDashboardView`, no cliente.
2. **É persistido?** Não. Nenhuma tabela guarda condição.
3. **É calculado?** Sim, a cada render, a partir de séries, métricas e amostras.
4. **É mock?** Não. Os números são reais, vindos da API; o que é sintético são os *dados de origem*.
5. **É baseado em time-series?** Sim — `deviationRatio` sai das amostras.
6. **Depende da idade da amostra?** Só o eixo `freshness`; a condição em si, não.
7. **Existe lógica no backend?** Não.
8. **Existe só lógica no frontend?** Sim.

## Consequências práticas (gaps)

- **Filtro de classificação não pode ser server-side hoje.** O servidor não conhece
  "Atenção demonstrativa": para filtrar por isso na API seria preciso mover o cálculo
  (ou materializá-lo) para o backend. Por isso, nesta etapa, os filtros server-side
  implementados foram os que o domínio já sustenta — tipo de máquina, modelo de sensor,
  presença de sensor e busca textual.
- **Custo de leitura.** Classificar exige baixar métricas/amostras de todas as séries no
  cliente; não escala para uma planta grande.
- **Sem histórico.** Como nada é persistido, não há "estava em atenção ontem".
- **O KPI "Sinais de atenção" mistura os dois eixos** (condição + ausência + recência),
  o que explica ele igualar o total de pontos quando as leituras estão fora da janela.
- **Os limiares 1,5 e 2,0 são didáticos**, calibrados contra o gerador sintético. Não são
  limites industriais nem derivados de norma.

## Recomendação para a próxima etapa (não executada aqui)

Antes de redesenhar a matriz, decidir o domínio: se "condição" deve virar conceito de
primeira classe (persistido, com histórico e filtrável na API) ou permanecer uma leitura
derivada do cliente. As duas opções são defensáveis; o que não se deve fazer é
transformar os rótulos atuais em schema sem essa decisão.
