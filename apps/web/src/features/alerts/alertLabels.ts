/**
 * Vocabulário de ALERTA na interface. O tipo descreve a REGRA que disparou — nunca um
 * diagnóstico: "vibração acima da baseline" é o que o motor sabe; "rolamento" seria
 * inventar causa.
 */
import type {
  AlertEventType,
  AlertLevel,
  AlertOccurrenceDto,
  AlertResolutionReason,
  AlertStatus,
  AlertThresholdMode,
  AlertType,
} from '@dynamox/domain';

import { formatNumber } from '../dashboard/dashboardFormatters';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  'vibration-threshold': 'Vibração acima da baseline',
  'temperature-threshold': 'Temperatura acima da baseline',
  'sensor-silent': 'Sensor sem telemetria',
  'fleet-silent': 'Planta sem telemetria',
};

export const ALERT_TYPE_SHORT: Record<AlertType, string> = {
  'vibration-threshold': 'Vibração',
  'temperature-threshold': 'Temperatura',
  'sensor-silent': 'Sensor mudo',
  'fleet-silent': 'Planta muda',
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open: 'Aberto',
  acknowledged: 'Reconhecido',
  resolved: 'Resolvido',
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  A1: 'A1 · alerta',
  A2: 'A2 · crítico',
};

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  opened: 'Aberto',
  escalated: 'Escalado',
  acknowledged: 'Reconhecido',
  resolved: 'Resolvido',
};

export const ALERT_RESOLUTION_LABELS: Record<AlertResolutionReason, string> = {
  'condition-cleared': 'condição normalizou',
  'telemetry-resumed': 'telemetria voltou',
};

export const ALERT_FAMILY_LABELS = {
  condition: 'Condição',
  'data-quality': 'Qualidade do dado',
} as const;

/** Medida comparada ao limiar, na unidade que faz sentido para o modo da regra. */
export function formatMeasure(measure: number | null, mode: AlertThresholdMode): string {
  if (measure === null || !Number.isFinite(measure)) return '—';
  switch (mode) {
    case 'ratio-to-baseline':
      return `${formatNumber(measure, 2)}×`;
    case 'delta-from-baseline':
      return `${measure >= 0 ? '+' : '−'}${formatNumber(Math.abs(measure), 1)} °C`;
    case 'elapsed-intervals':
      return `${formatNumber(measure, 1)} intervalos`;
    default:
      return formatNumber(measure, 2);
  }
}

export function formatThreshold(threshold: number | null, mode: AlertThresholdMode): string {
  return formatMeasure(threshold, mode);
}

/** Como o limiar é lido: "≥ 1,5× da baseline", "≥ +5 °C sobre a baseline", "> 4 intervalos de 15 min". */
export function describeThresholdMode(mode: AlertThresholdMode): string {
  switch (mode) {
    case 'ratio-to-baseline':
      return 'razão entre a leitura e a baseline aprendida do ponto';
    case 'delta-from-baseline':
      return 'diferença entre a leitura e a baseline aprendida do ponto';
    case 'elapsed-intervals':
      return 'intervalos esperados de aquisição decorridos sem dado';
    default:
      return mode;
  }
}

/** Identidade curta de um episódio: máquina · ponto · sensor, ou "planta" no escopo de frota. */
export function alertIdentity(alert: Pick<AlertOccurrenceDto, 'scope' | 'machineName' | 'monitoringPointName' | 'sensorSerialNumber' | 'affectedCount'>): string {
  if (alert.scope === 'fleet') {
    return alert.affectedCount ? `Planta · ${alert.affectedCount} pontos` : 'Planta';
  }
  return [alert.machineName, alert.monitoringPointName, alert.sensorSerialNumber].filter(Boolean).join(' · ') || '—';
}

/** Frase única de "o que está acontecendo", para lista e detalhe. */
export function alertSummary(alert: AlertOccurrenceDto): string {
  const last = formatMeasure(alert.last.measure, alert.thresholdMode);
  switch (alert.type) {
    case 'vibration-threshold':
      return `RMS radial em ${last} da baseline (limiar ${formatThreshold(alert.trigger.threshold, alert.thresholdMode)})`;
    case 'temperature-threshold':
      return `temperatura ${last} sobre a baseline (limiar ${formatThreshold(alert.trigger.threshold, alert.thresholdMode)})`;
    case 'sensor-silent':
      return `sem aquisição há ${last}`;
    case 'fleet-silent':
      return `${alert.affectedCount ?? 0} pontos sem aquisição há ${last}`;
    default:
      return last;
  }
}
