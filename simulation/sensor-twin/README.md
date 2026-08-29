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

Estado atual: **B1/B2** — parâmetros de cenário e síntese determinística do sinal.
Contrato/ingestão (B3/B4) e a camada ROS opcional (B5) chegam nos próximos blocos;
este guia será completado junto (B6).

```bash
npm run test -w @dynamox/sensor-twin    # unitários puros (sem rede, banco ou ROS)
```
