/**
 * Loop deliberativo (F6): OBSERVE → RANK → DECIDE → ACT → RE-OBSERVE → RECOMMEND.
 *
 * A confirmação NÃO é replay idempotente: é uma NOVA aquisição do sensor que os DADOS
 * selecionaram — janela própria (confirm) e seed determinística independente
 * (seed + CONFIRM_SEED_OFFSET) ⇒ mesma condição sintética, realização de ruído
 * diferente. O supervisor só escolhe QUEM confirmar; a realidade sintética do sinal
 * pertence ao simulador (manifest). A transição de estado nasce SEMPRE da releitura do
 * banco — duplicate é transporte, nunca evidência.
 */
import {
  SYNTHETIC_ATTENTION_RATIO,
  assessFleet,
  meanOf,
  observeWindowRadial,
  seriesIdsForPlant,
  type FleetAssessment,
  type SensorAssessment,
  type SensorState,
} from './assess';
import { identityFor, scenarioForSensor, type ResolvedResourceIds } from './fleet';
import { ingestCycle, type TwinApiConfig } from './ingest';
import { buildCycle } from './payload';
import { CONFIRM_SEED_OFFSET, PLANT, plantSensors, type PlantManifest } from './plant';

export interface ConfirmationEvidence {
  sensorSerial: string;
  ingestStatus: number;
  ingestDuplicate: boolean;
  fingerprint: string;
  confirmRadialRms: number;
  confirmRatio: number;
}

export interface DeliberationResult {
  assessment: FleetAssessment;
  action: 'CONFIRM_ACQUISITION' | 'NONE';
  confirmation: ConfirmationEvidence | null;
  finalState: SensorState | null;
  recommendation: string | null;
}

/** Regra mínima de transição: confirmação também acima do limiar ⇒ CONFIRMED_ATTENTION. */
export function confirmTransition(
  conditionRatio: number,
  confirmRatio: number,
  threshold: number = SYNTHETIC_ATTENTION_RATIO,
): SensorState {
  if (conditionRatio >= threshold && confirmRatio >= threshold) return 'CONFIRMED_ATTENTION';
  return conditionRatio >= threshold ? 'SUSPECT' : 'STABLE';
}

/** Recomendação limitada: prioriza atenção; JAMAIS diagnostica falha. */
export function buildRecommendation(
  sensor: SensorAssessment,
  confirmation: ConfirmationEvidence,
): string {
  return (
    `Prioritize inspection — ${sensor.machineName} / ${sensor.shortLabel} ` +
    `(${sensor.sensorSerial}): radial RMS ${sensor.deviationRatio.toFixed(2)}x the synthetic ` +
    `baseline; confirmatory acquisition consistent (${confirmation.confirmRatio.toFixed(2)}x).`
  );
}

/**
 * OBSERVE → RANK → DECIDE → ACT → RE-OBSERVE → RECOMMEND.
 * O supervisor escolhe QUAL sensor confirmar; a realidade sintética do sinal pertence
 * ao simulador (manifest) — o supervisor nunca lê rótulos de cenário.
 */
export async function deliberate(
  config: TwinApiConfig,
  token: string,
  plant: PlantManifest = PLANT,
  resourceIds: ResolvedResourceIds,
): Promise<DeliberationResult> {
  const assessment = await assessFleet(config, token, plant);

  if (!assessment.selected) {
    return {
      assessment,
      action: 'NONE',
      confirmation: null,
      finalState: null,
      recommendation: null,
    };
  }

  // ACT: nova aquisição do sensor QUE OS DADOS SELECIONARAM — janela e seed próprios
  // da confirmação (realização de ruído independente). O supervisor só escolhe QUEM
  // confirmar; a realidade sintética do sinal é resolvida pelo simulador (manifest).
  const sensors = plantSensors(plant);
  const target = sensors.find((s) => s.sensorSerial === assessment.selected!.sensorSerial)!;
  const confirmCycle = buildCycle(
    scenarioForSensor(plant, target, 'confirm'),
    {
      seed: target.seed + CONFIRM_SEED_OFFSET,
      rpm: target.rpm,
      loadPercent: target.loadPercent,
      baseTimestamp: plant.windows.confirm,
    },
    identityFor(target, resourceIds),
  );
  const ingestion = await ingestCycle(config, token, confirmCycle);

  // RE-OBSERVE: a conclusão nasce do BANCO, nunca do resultado interno do gerador.
  const ids = (await seriesIdsForPlant(config, token, [target])).get(target.sensorSerial)!;
  const confirmRadial = await observeWindowRadial(
    config, token, ids, plant.windows.confirm, target.sensorSerial, 'confirm',
  );
  const confirmRadialRms = meanOf(confirmRadial);
  const confirmRatio = confirmRadialRms / assessment.selected.baselineRadialRms;

  const confirmation: ConfirmationEvidence = {
    sensorSerial: target.sensorSerial,
    ingestStatus: ingestion.status,
    ingestDuplicate: ingestion.body.duplicate,
    fingerprint: ingestion.body.payloadFingerprint,
    confirmRadialRms,
    confirmRatio,
  };

  const finalState = confirmTransition(assessment.selected.deviationRatio, confirmRatio);

  return {
    assessment,
    action: 'CONFIRM_ACQUISITION',
    confirmation,
    finalState,
    recommendation:
      finalState === 'CONFIRMED_ATTENTION'
        ? buildRecommendation(assessment.selected, confirmation)
        : null,
  };
}
