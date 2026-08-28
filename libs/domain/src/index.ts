export const MACHINE_TYPES = ['Pump', 'Fan'] as const;
export type MachineType = (typeof MACHINE_TYPES)[number];

export const SENSOR_MODELS = ['TcAg', 'TcAs', 'HF+'] as const;
export type SensorModel = (typeof SENSOR_MODELS)[number];

export const PHYSICAL_QUANTITIES = [
  'acceleration',
  'velocity',
  'temperature',
  'rotationalSpeed',
] as const;
export type PhysicalQuantity = (typeof PHYSICAL_QUANTITIES)[number];

export const AXES = ['x', 'y', 'z'] as const;
export type Axis = (typeof AXES)[number];

/** Grandezas vetoriais só fazem sentido acompanhadas de um eixo de medição. */
export const VECTOR_QUANTITIES: readonly PhysicalQuantity[] = ['acceleration', 'velocity'];

/** Grandezas escalares nunca têm eixo; são persistidas com Axis.NONE, jamais com NULL. */
export const SCALAR_QUANTITIES: readonly PhysicalQuantity[] = ['temperature', 'rotationalSpeed'];

export function isAxisValidForQuantity(
  physicalQuantity: PhysicalQuantity,
  axis: Axis | undefined,
): boolean {
  if (VECTOR_QUANTITIES.includes(physicalQuantity)) {
    return axis !== undefined;
  }
  return axis === undefined;
}

export class QuantityAxisMismatchError extends Error {
  constructor(
    readonly physicalQuantity: PhysicalQuantity,
    readonly axis: Axis | undefined,
  ) {
    super(
      VECTOR_QUANTITIES.includes(physicalQuantity)
        ? `A grandeza "${physicalQuantity}" é vetorial e exige um eixo (x, y ou z).`
        : `A grandeza "${physicalQuantity}" é escalar e não aceita eixo (recebido "${axis}").`,
    );
    this.name = 'QuantityAxisMismatchError';
  }
}

export function assertAxisValidForQuantity(
  physicalQuantity: PhysicalQuantity,
  axis: Axis | undefined,
): void {
  if (!isAxisValidForQuantity(physicalQuantity, axis)) {
    throw new QuantityAxisMismatchError(physicalQuantity, axis);
  }
}

/**
 * Sensores TcAg e TcAs não suportam a faixa de vibração exigida por bombas, por isso o
 * enunciado proíbe associá-los a máquinas do tipo Pump. A regra vive aqui, e não no
 * controller, para que API, seed e frontend apliquem exatamente o mesmo critério.
 */
export const SENSOR_MODELS_BLOCKED_FOR_PUMP: readonly SensorModel[] = ['TcAg', 'TcAs'];

export function isSensorModelAllowedForMachine(
  machineType: MachineType,
  sensorModel: SensorModel,
): boolean {
  if (machineType === 'Pump') {
    return !SENSOR_MODELS_BLOCKED_FOR_PUMP.includes(sensorModel);
  }
  return true;
}

export function assertSensorModelAllowedForMachine(
  machineType: MachineType,
  sensorModel: SensorModel,
): void {
  if (!isSensorModelAllowedForMachine(machineType, sensorModel)) {
    throw new SensorModelNotAllowedError(machineType, sensorModel);
  }
}

export class SensorModelNotAllowedError extends Error {
  constructor(
    readonly machineType: MachineType,
    readonly sensorModel: SensorModel,
  ) {
    super(
      `O modelo de sensor "${sensorModel}" não pode ser associado a uma máquina do tipo "${machineType}".`,
    );
    this.name = 'SensorModelNotAllowedError';
  }
}

export function isMachineType(value: unknown): value is MachineType {
  return typeof value === 'string' && (MACHINE_TYPES as readonly string[]).includes(value);
}

export function isSensorModel(value: unknown): value is SensorModel {
  return typeof value === 'string' && (SENSOR_MODELS as readonly string[]).includes(value);
}

export interface SeriesMetrics {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  last: number | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
}

export const EMPTY_SERIES_METRICS: SeriesMetrics = {
  count: 0,
  min: null,
  max: null,
  avg: null,
  last: null,
  firstTimestamp: null,
  lastTimestamp: null,
};

export interface TimeSeriesSummary {
  id: string;
  sensorSerialNumber: string;
  sensorModel: SensorModel;
  /**
   * Nulos quando o sensor não está associado a um ponto de monitoramento. Inventar um
   * valor padrão aqui faria a API afirmar um tipo de máquina que não existe.
   */
  machineName: string | null;
  machineType: MachineType | null;
  monitoringPointName: string | null;
  physicalQuantity: PhysicalQuantity;
  axis: Axis | null;
  unit: string;
  displayName: Record<string, string> | null;
  sampleCount: number;
}

export interface TimeSeriesSampleDto {
  timestamp: string;
  value: number;
}

/** Página de amostras: recuperação completa por offset, nunca truncamento silencioso. */
export interface TimeSeriesSamplePage {
  items: TimeSeriesSampleDto[];
  total: number;
  limit: number;
  offset: number;
}
