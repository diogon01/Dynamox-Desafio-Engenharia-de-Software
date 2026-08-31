/**
 * Backfill do motor de alertas sobre o histórico já ingerido — a MESMA função de decisão da
 * ingestão ao vivo, com o relógio replayado. Idempotente por construção: a evidência e a
 * avaliação (ciclo, regra, versão) só entram uma vez; reexecutar produz zero avaliações novas.
 *
 *   npm run alerts:backfill -- --dry-run                     # só lista ciclos por dia
 *   npm run alerts:backfill                                  # aplica tudo que ainda não foi avaliado
 *   npm run alerts:backfill -- --from 2026-08-10T00:00:00Z --to 2026-08-12T00:00:00Z
 *   npm run alerts:backfill -- --sensors SIM-HF-002,SIM-HF-007
 *   npm run alerts:backfill -- --reset --yes                 # zera as tabelas DO MOTOR e refaz
 *
 * O que ele nunca toca: amostras, séries, ciclos, cadastro. `--reset` apaga só evidência,
 * avaliações, estados, ocorrências e eventos de alerta.
 *
 * Presença: a varredura roda a cada 15 min do relógio replayado, depois de aplicada a
 * evidência de cada bloco (`--bucket-minutes`, padrão 60). Um dia sem ciclo algum recebe uma
 * varredura só, no fim do dia.
 */
import { writeFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

import { AlertEngine, EMPTY_SUMMARY, type EvaluationSummary, mergeSummaries } from './alert-engine';
import { ensureAlertRules } from './alert-rules';
import { type CycleEvidence, listCyclesStartedBetween, loadCycleEvidence } from './alerts.sql';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SWEEP_STEP_MS = 15 * MINUTE_MS;
const EVIDENCE_CHUNK = 300;

interface Options {
  from: Date | null;
  to: Date | null;
  sensors: string[];
  dryRun: boolean;
  reset: boolean;
  yes: boolean;
  report: string | null;
  bucketMinutes: number;
  presence: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    from: null,
    to: null,
    sensors: [],
    dryRun: false,
    reset: false,
    yes: false,
    report: null,
    bucketMinutes: 60,
    presence: true,
  };
  const date = (flag: string, raw: string | undefined): Date => {
    const parsed = raw ? new Date(raw) : new Date(Number.NaN);
    if (Number.isNaN(parsed.getTime())) throw new Error(`${flag} exige uma data ISO válida (recebido "${raw ?? ''}").`);
    return parsed;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--from') options.from = date(flag, argv[++i]);
    else if (flag === '--to') options.to = date(flag, argv[++i]);
    else if (flag === '--sensors') options.sensors = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (flag === '--report') options.report = argv[++i] ?? null;
    else if (flag === '--bucket-minutes') options.bucketMinutes = Math.max(15, Number(argv[++i]) || 60);
    else if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--reset') options.reset = true;
    else if (flag === '--yes') options.yes = true;
    else if (flag === '--no-presence') options.presence = false;
    else throw new Error(`Argumento desconhecido: ${flag}`);
  }
  if (options.reset && options.sensors.length > 0) {
    throw new Error('--reset é global (zera o estado de todos os pontos); não combine com --sensors.');
  }
  return options;
}

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!['localhost', '127.0.0.1', 'db'].includes(host)) {
    throw new Error(`O backfill só roda contra banco local (DATABASE_URL aponta para "${host || 'inválido'}").`);
  }
}

const utcDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;
const iso = (ms: number) => new Date(ms).toISOString();
const dayLabel = (ms: number) => iso(ms).slice(0, 10);
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

async function dataRange(prisma: PrismaClient): Promise<{ from: number; to: number } | null> {
  const rows = await prisma.$queryRaw<Array<{ first: Date | null; last: Date | null }>>`
    SELECT min(b.first) AS first, max(b.last) AS last
    FROM time_series ts
    CROSS JOIN LATERAL (
      SELECT min(p."timestamp") AS first, max(p."timestamp") AS last
      FROM time_series_samples p WHERE p."timeSeriesId" = ts.id
    ) b
  `;
  const first = rows[0]?.first ?? null;
  const last = rows[0]?.last ?? null;
  return first && last ? { from: first.getTime(), to: last.getTime() } : null;
}

async function resetEngineTables(prisma: PrismaClient): Promise<void> {
  const before = {
    events: await prisma.alertEvent.count(),
    occurrences: await prisma.alertOccurrence.count(),
    states: await prisma.alertRuleState.count(),
    evaluations: await prisma.alertRuleEvaluation.count(),
    evidence: await prisma.alertCycleEvidence.count(),
  };
  await prisma.$transaction([
    prisma.alertEvent.deleteMany(),
    prisma.alertOccurrence.deleteMany(),
    prisma.alertRuleState.deleteMany(),
    prisma.alertRuleEvaluation.deleteMany(),
    prisma.alertCycleEvidence.deleteMany(),
  ]);
  console.log(
    `reset: removidos ${before.occurrences} ocorrências · ${before.events} eventos · ${before.states} estados · ` +
      `${before.evaluations} avaliações · ${before.evidence} evidências (amostras e ciclos intactos).`,
  );
}

interface DayLine {
  day: string;
  cycles: number;
  elapsedMs: number;
  summary: EvaluationSummary;
  presence: { opened: number; escalated: number; resolved: number };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  assertLocalDatabase();
  const prisma = new PrismaClient();
  const startedAt = Date.now();

  try {
    const rules = (await ensureAlertRules(prisma)).filter((rule) => rule.enabled);
    const engine = new AlertEngine(prisma, rules);
    console.log(`regras habilitadas..: ${rules.map((rule) => `${rule.key} (v${rule.policyVersion})`).join(', ')}`);

    if (options.reset) {
      if (!options.yes) {
        console.log('Nada apagado. --reset exige --yes (ou use --dry-run para só listar).');
        process.exitCode = 2;
        return;
      }
      if (options.dryRun) console.log('dry-run: --reset ignorado.');
      else await resetEngineTables(prisma);
    }

    const range = await dataRange(prisma);
    if (!range) {
      console.log('Banco sem amostras: nada a fazer.');
      return;
    }
    const fromMs = options.from?.getTime() ?? range.from;
    const toMs = options.to?.getTime() ?? range.to + 1;
    console.log(`janela..............: ${iso(fromMs)} → ${iso(toMs)}${options.sensors.length ? ` · sensores ${options.sensors.join(', ')}` : ''}`);
    console.log(`bloco de aplicação..: ${options.bucketMinutes} min · varredura de presença: ${options.presence ? 'a cada 15 min (replay)' : 'desligada'}`);

    const total: EvaluationSummary = { ...EMPTY_SUMMARY };
    const presenceTotal = { opened: 0, escalated: 0, resolved: 0 };
    const lines: DayLine[] = [];
    let cyclesListed = 0;

    for (let day = utcDay(fromMs); day < toMs; day += DAY_MS) {
      const dayStart = Math.max(day, fromMs);
      const dayEnd = Math.min(day + DAY_MS, toMs);
      const dayStartedAt = Date.now();
      const refs = await listCyclesStartedBetween(prisma, new Date(dayStart), new Date(dayEnd), options.sensors);
      cyclesListed += refs.length;

      if (options.dryRun) {
        if (refs.length > 0) console.log(`${dayLabel(day)}  ${String(refs.length).padStart(5)} ciclos`);
        continue;
      }

      const daySummary: EvaluationSummary = { ...EMPTY_SUMMARY };
      const dayPresence = { opened: 0, escalated: 0, resolved: 0 };
      const sweepAt = async (nowMs: number) => {
        if (!options.presence) return;
        const sweep = await engine.sweepPresence(nowMs);
        dayPresence.opened += sweep.opened;
        dayPresence.escalated += sweep.escalated;
        dayPresence.resolved += sweep.resolved;
      };

      if (refs.length === 0) {
        await sweepAt(dayEnd);
      } else {
        // Evidência do dia em lotes; depois aplicada por bloco, com as varreduras do bloco.
        const evidence: CycleEvidence[] = [];
        for (let offset = 0; offset < refs.length; offset += EVIDENCE_CHUNK) {
          const ids = refs.slice(offset, offset + EVIDENCE_CHUNK).map((ref) => ref.cycleId);
          evidence.push(...(await loadCycleEvidence(prisma, ids)));
        }
        evidence.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.cycleId.localeCompare(b.cycleId));

        const bucketMs = options.bucketMinutes * MINUTE_MS;
        let cursor = 0;
        for (let bucket = dayStart; bucket < dayEnd; bucket += bucketMs) {
          const bucketEnd = Math.min(bucket + bucketMs, dayEnd);
          const slice: CycleEvidence[] = [];
          while (cursor < evidence.length && evidence[cursor].startedAt.getTime() < bucketEnd) {
            slice.push(evidence[cursor]);
            cursor += 1;
          }
          if (slice.length > 0) mergeSummaries(daySummary, await engine.applyEvidence(slice, { timeoutMs: 120_000 }));
          for (let tick = bucket + SWEEP_STEP_MS; tick <= bucketEnd; tick += SWEEP_STEP_MS) await sweepAt(tick);
        }
      }

      mergeSummaries(total, daySummary);
      presenceTotal.opened += dayPresence.opened;
      presenceTotal.escalated += dayPresence.escalated;
      presenceTotal.resolved += dayPresence.resolved;
      const elapsedMs = Date.now() - dayStartedAt;
      lines.push({ day: dayLabel(day), cycles: refs.length, elapsedMs, summary: daySummary, presence: dayPresence });
      if (refs.length > 0 || dayPresence.opened + dayPresence.escalated + dayPresence.resolved > 0) {
        console.log(
          `${dayLabel(day)}  ${String(refs.length).padStart(5)} ciclos · ${seconds(elapsedMs).padStart(7)} · ` +
            `avaliações ${String(daySummary.evaluations).padStart(5)} · abertos ${daySummary.opened} · escalados ${daySummary.escalated} · ` +
            `resolvidos ${daySummary.resolved + daySummary.resumed} · presença +${dayPresence.opened}/↑${dayPresence.escalated}/−${dayPresence.resolved} · ` +
            `fora de ordem ${daySummary.outOfOrder}`,
        );
      }
    }

    const elapsedMs = Date.now() - startedAt;
    if (options.dryRun) {
      console.log(`dry-run: ${cyclesListed} ciclos na janela; nada aplicado.`);
      return;
    }
    console.log('—');
    console.log(`ciclos listados......: ${cyclesListed}`);
    console.log(`avaliações novas.....: ${total.evaluations} (reexecução idempotente ⇒ 0)`);
    console.log(`episódios............: abertos ${total.opened + presenceTotal.opened} · escalados ${total.escalated + presenceTotal.escalated} · resolvidos ${total.resolved + total.resumed + presenceTotal.resolved}`);
    console.log(`fora de ordem........: ${total.outOfOrder} · sem ponto: ${total.unassigned}`);
    console.log(`tempo................: ${seconds(elapsedMs)}`);

    if (options.report) {
      writeFileSync(
        options.report,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            window: { from: iso(fromMs), to: iso(toMs) },
            sensors: options.sensors,
            rules: rules.map((rule) => ({ key: rule.key, policyVersion: rule.policyVersion })),
            totals: { ...total, presence: presenceTotal, cyclesListed, elapsedMs },
            days: lines,
          },
          null,
          2,
        ),
      );
      console.log(`relatório............: ${options.report}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha no backfill:', error);
  process.exitCode = 1;
});
