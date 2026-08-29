/**
 * Mapeamento das janelas para o contrato REAL de telemetria (B3).
 *
 * Nada aqui inventa formato: o payload segue `contracts/dynamox/telemetry-cycle.schema.json`
 * na forma do exemplo oficial, é validado pelo MESMO Ajv do backend
 * (`validateTelemetryCycle`) e canonicalizado pelo MESMO fingerprint
 * (`computePayloadFingerprint`) — a "representação canônica" do twin é literalmente a
 * da aplicação, não uma cópia local.
 */
import {
  computePayloadFingerprint,
  deterministicResourceId,
  isValidIdempotencyKey,
  validateTelemetryCycle,
  type TelemetryCyclePayload,
  type TelemetryMeasurement,
} from '@dynamox/contracts';

import { generateStream } from './signal';
import { windowStream, type CycleWindows } from './windows';
import { TWIN_IDENTITY, getScenarioConfig, type ScenarioConfig } from './scenarios';

/**
 * resourceId do ponto monitorado — derivado com a MESMA função e as MESMAS entradas do
 * seed do banco (nome da máquina + nome do ponto), portanto idêntico ao que o backend
 * exige em RESOURCE_ID_MISMATCH. Para os defaults: 42d726ba50f8645df08dba9f.
 */
export function monitoringPointResourceId(): string {
  return deterministicResourceId(
    'dynamox-challenge',
    'monitoring-point',
    TWIN_IDENTITY.machineName,
    TWIN_IDENTITY.monitoringPointName,
  );
}

/** `sim.SIM-HF-001.normal.s42.20260830T090000Z` — legível e dentro do charset da API. */
export function idempotencyKeyFor(config: ScenarioConfig): string {
  const compactStart = config.baseTimestamp.replace(/[-:]/g, '').replace('.000Z', 'Z');
  const key = `sim.${TWIN_IDENTITY.sensorSerial}.${config.scenario}.s${config.seed}.${compactStart}`;
  if (!isValidIdempotencyKey(key)) {
    throw new Error(`Idempotency-Key gerada fora do contrato da API: "${key}"`);
  }
  return key;
}

const DISPLAY_NAMES = {
  x: { pt: 'Aceleração RMS — eixo X', en: 'Acceleration RMS — X axis' },
  y: { pt: 'Aceleração RMS — eixo Y', en: 'Acceleration RMS — Y axis' },
  z: { pt: 'Aceleração RMS — eixo Z', en: 'Acceleration RMS — Z axis' },
  temperature: { pt: 'Temperatura do mancal', en: 'Bearing temperature' },
  rotationalSpeed: { pt: 'Rotação do eixo', en: 'Shaft rotational speed' },
} as const;

function dataPoints(timestamps: string[], values: number[]) {
  return timestamps.map((timestamp, index) => ({ timestamp, value: values[index] }));
}

export function buildCyclePayload(windows: CycleWindows): TelemetryCyclePayload {
  const { config } = windows;
  const resourceId = monitoringPointResourceId();

  const accelerationMeasurement = (axis: 'x' | 'y' | 'z'): TelemetryMeasurement => ({
    resourceId,
    attributes: {
      physicalQuantity: 'acceleration',
      axis,
      unit: 'g',
      displayName: { ...DISPLAY_NAMES[axis] },
    },
    dataPoints: dataPoints(windows.windowTimestamps, windows.rmsG[axis]),
  });

  const payload: TelemetryCyclePayload = {
    telemetryCycleData: {
      measuringSystemUniqueIdentifier: TWIN_IDENTITY.sensorSerial,
      measuringSystemModel: { name: TWIN_IDENTITY.generatorName, version: 1 },
      measurements: [
        accelerationMeasurement('x'),
        accelerationMeasurement('y'),
        accelerationMeasurement('z'),
        {
          resourceId,
          attributes: {
            physicalQuantity: 'temperature',
            unit: 'degC',
            displayName: { ...DISPLAY_NAMES.temperature },
          },
          dataPoints: dataPoints(windows.windowTimestamps, windows.temperaturesC),
        },
        {
          resourceId,
          attributes: {
            physicalQuantity: 'rotationalSpeed',
            unit: 'rpm',
            displayName: { ...DISPLAY_NAMES.rotationalSpeed },
          },
          dataPoints: dataPoints(windows.windowTimestamps, windows.rpms),
        },
      ],
      metadata: {
        origin: 'simulation',
        generator: {
          name: TWIN_IDENTITY.generatorName,
          version: TWIN_IDENTITY.generatorVersion,
        },
        profile: TWIN_IDENTITY.sensorProfile,
        cycleId: deterministicResourceId(
          'dynamox-challenge',
          'twin-cycle',
          config.scenario,
          `s${config.seed}`,
          config.baseTimestamp,
        ),
        seed: config.seed,
        synthetic: true,
      },
      tags: ['simulated', 'pump-p101', 'hf-plus', `scenario:${config.scenario}`],
    },
    configuration: {
      monitoringLocationMap: [
        {
          mapLabel: `${TWIN_IDENTITY.machineName} / ${TWIN_IDENTITY.monitoringPointName}`,
          mapValue: resourceId,
        },
      ],
      rpm: config.rpm,
      loadPercent: config.loadPercent,
      scenario: config.scenario,
      seed: config.seed,
      durationSeconds: config.durationSeconds,
      publishRateHz: 1 / config.windowSeconds,
    },
  };

  // Falhar aqui, alto e cedo: um ciclo que não valida no Ajv REAL nunca sai do gerador.
  const result = validateTelemetryCycle(payload);
  if (!result.valid) {
    const details = result.violations
      .map((violation) => `${violation.path}: ${violation.message}`)
      .join('; ');
    throw new Error(`Ciclo sintético violou o contrato interno: ${details}`);
  }

  return result.payload;
}

export interface BuiltCycle {
  config: ScenarioConfig;
  payload: TelemetryCyclePayload;
  idempotencyKey: string;
  /** Fingerprint canônico da APLICAÇÃO (não uma cópia local). */
  fingerprint: string;
}

/** Cenário → stream → janelas → payload validado, em uma chamada determinística. */
export function buildCycle(
  scenario: unknown,
  overrides: Partial<Omit<ScenarioConfig, 'scenario'>> = {},
): BuiltCycle {
  const config = getScenarioConfig(scenario, overrides);
  const windows = windowStream(generateStream(config));
  const payload = buildCyclePayload(windows);

  return {
    config,
    payload,
    idempotencyKey: idempotencyKeyFor(config),
    fingerprint: computePayloadFingerprint(payload),
  };
}
