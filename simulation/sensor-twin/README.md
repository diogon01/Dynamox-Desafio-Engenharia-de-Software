# @dynamox/sensor-twin — gêmeo digital do sensor HF+ (BON-06)

Gerador **determinístico** de ciclos de telemetria para a bomba P-101 do seed
(ponto "Mancal lado acoplamento", sensor sintético `SIM-HF-001`, perfil HF+), ingeridos
pela API local através do contrato real (`contracts/dynamox/telemetry-cycle.schema.json`)
com o mesmo validador Ajv e o mesmo fingerprint do backend.

> **Dados sintéticos e didáticos.** As amplitudes são pedagógicas; nada aqui infere
> severidade real (ISO 10816), banda real do HF+ ou diagnóstico físico. O que o gêmeo
> demonstra é o pipeline industrial completo — ativo → sensor → aquisição → contrato →
> idempotência → série → visualização — de forma reprodutível.

Plano completo e decisões: [`docs/planning/BON-06_EXECUTION_PLAN_V2.md`](../../docs/planning/BON-06_EXECUTION_PLAN_V2.md).

Estado atual: **B1–B4** — síntese determinística, janelamento RMS, mapeamento para o
contrato real e ingestão end-to-end pela API existente. Camada ROS opcional (B5) e o
guia completo (B6) chegam nos próximos blocos.

Testes: **276 na suíte convencional** (152 API, 82 web, 42 sensor twin) **+ 6 testes de
integração do twin executados separadamente** — a integração exige a API local no ar e
nunca roda no `npm run test`.

```bash
npm run test -w @dynamox/sensor-twin    # 42 unitários puros (sem rede, banco ou ROS)
npm run twin:cycle -- --scenario normal # gera e valida um ciclo localmente
npm run twin:ingest -- --scenario imbalance  # gera, autentica e envia à API local
npm run twin:integration                # prova end-to-end (exige db:up + dev:api)
```
