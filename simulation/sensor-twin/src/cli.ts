/**
 * CLI do gêmeo digital.
 *
 *   generate --scenario normal|imbalance [--seed N] [--json]
 *     gera e valida um ciclo localmente (sem API), imprimindo o resumo auditável.
 *
 *   ingest --scenario normal|imbalance [--seed N]
 *     gera, autentica na API local e envia; depois PROVA a persistência lendo de volta
 *     as séries e amostras pelos endpoints reais.
 */
import { buildCycle } from './payload';
import { fetchAllSamples, fetchSeries, ingestCycle, loadTwinConfig, login } from './ingest';

interface CliArgs {
  command: string | undefined;
  scenario: string | undefined;
  seed: number | undefined;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { command: argv[0], scenario: undefined, seed: undefined, json: false };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === '--scenario') args.scenario = argv[++i];
    else if (argv[i] === '--seed') args.seed = Number(argv[++i]);
    else if (argv[i] === '--json') args.json = true;
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  return args;
}

function summarize(cycle: ReturnType<typeof buildCycle>): void {
  const { measurements } = cycle.payload.telemetryCycleData;
  const points = measurements.reduce((sum, m) => sum + m.dataPoints.length, 0);
  const meanOf = (index: number) => {
    const values = measurements[index].dataPoints.map((p) => p.value);
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  console.log(`cenário............: ${cycle.config.scenario}`);
  console.log(`sensor.............: ${cycle.identity.sensorSerial} (${cycle.identity.sensorModel}) em ${cycle.identity.machineName}/${cycle.identity.monitoringPointName}`);
  console.log(`janela.............: ${cycle.config.baseTimestamp} +${cycle.config.durationSeconds}s (seed ${cycle.config.seed})`);
  console.log(`measurements.......: ${measurements.length} (${points} dataPoints)`);
  console.log(`RMS médio (g)......: x=${meanOf(0).toFixed(6)} y=${meanOf(1).toFixed(6)} z=${meanOf(2).toFixed(6)}`);
  console.log(`Idempotency-Key....: ${cycle.idempotencyKey}`);
  console.log(`fingerprint........: ${cycle.fingerprint}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const overrides = args.seed !== undefined ? { seed: args.seed } : {};

  if (args.command === 'generate') {
    const cycle = buildCycle(args.scenario, overrides);
    summarize(cycle);
    console.log('validação..........: OK (Ajv real de @dynamox/contracts)');
    if (args.json) console.log(JSON.stringify(cycle.payload, null, 2));
    return;
  }

  if (args.command === 'ingest') {
    const cycle = buildCycle(args.scenario, overrides);
    summarize(cycle);

    const config = loadTwinConfig();
    const token = await login(config);
    console.log(`login..............: OK (${config.email} em ${config.baseUrl})`);

    const { status, body } = await ingestCycle(config, token, cycle);
    console.log(`ingestão...........: HTTP ${status} duplicate=${body.duplicate} cycleId=${body.cycleId}`);
    console.log(`fingerprint (API)..: ${body.payloadFingerprint}`);
    if (body.payloadFingerprint !== cycle.fingerprint) {
      throw new Error('fingerprint local difere do da API — investigar antes de confiar no ciclo.');
    }

    // Prova de persistência: ler de volta pelos endpoints reais.
    const series = (await fetchSeries(config, token)).filter(
      (s) => s.sensorSerialNumber === cycle.identity.sensorSerial,
    );
    console.log(`séries do sensor...: ${series.length}`);
    const accelerationY = series.find((s) => s.physicalQuantity === 'acceleration' && s.axis === 'y');
    if (!accelerationY) throw new Error('série acceleration/y não encontrada após a ingestão.');
    const windowStart = cycle.payload.telemetryCycleData.measurements[1].dataPoints[0].timestamp;
    const samples = await fetchAllSamples(config, token, accelerationY.id);
    const inWindow = samples.filter((s) => s.timestamp >= windowStart);
    console.log(
      `persistência.......: acceleration/y total=${samples.length}; ≥${windowStart}: ${inWindow.length} amostras`,
    );
    return;
  }

  console.error('Uso: generate|ingest --scenario normal|imbalance [--seed N] [--json]');
  process.exit(2);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
