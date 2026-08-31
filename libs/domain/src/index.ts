/**
 * Perfis de acesso do desafio. Deliberadamente mínimos: o enunciado usa credenciais
 * fixas, então não há administração de usuários — apenas a distinção entre quem pode
 * alterar o estado persistido (ADMIN) e quem só consulta (VIEWER).
 */
export const USER_ROLES = ['ADMIN', 'VIEWER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** Perfis autorizados a alterar estado persistido (POST/PATCH/PUT/DELETE). */
export const ROLES_ALLOWED_TO_MUTATE: readonly UserRole[] = ['ADMIN'];

export function canMutate(role: UserRole): boolean {
  return ROLES_ALLOWED_TO_MUTATE.includes(role);
}

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
  /**
   * Total de amostras da série. `null` quando a listagem foi pedida sem contagem
   * (`withCounts=false`, o padrão): é um `count(*)` por série, caro no caminho do painel.
   * Para saber se a série tem dado, use `lastTimestamp`.
   */
  sampleCount: number | null;
  /**
   * Última leitura da série. Vem no resumo — e não só em `/metrics` — porque um painel
   * de frota precisa do valor e do instante de TODAS as séries para desenhar a matriz;
   * buscar métrica por série transformava uma tela em dezenas de requisições.
   */
  lastValue: number | null;
  lastTimestamp: string | null;
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

// ————— Camada analítica: resultados agregados, nunca telemetria bruta —————

/**
 * Classificação demonstrativa de um ponto monitorado. É a MESMA semântica que o painel
 * derivava no cliente — limiares didáticos 1,5× (observação) e 2,0× (atenção) sobre a
 * razão entre a aquisição atual e a de referência — agora calculada no banco.
 */
export type ConditionKind =
  | 'normal'
  | 'observation'
  | 'attention'
  | 'unclassified'
  | 'no-data'
  | 'no-sensor';

export type FreshnessKind = 'current' | 'stale' | 'future' | 'unknown';

/**
 * Condição de um ponto na janela consultada.
 *
 * `currentCycleId`/`baselineCycleId` deixam explícito QUAIS aquisições produziram a razão:
 * a atual é a mais recente da janela, a referência é a primeira da mesma janela — nunca
 * uma média do período inteiro, que já conteria a própria degradação.
 */
export interface FleetConditionPoint {
  machineName: string;
  machineType: MachineType | null;
  monitoringPointId: string;
  monitoringPointName: string;
  sensorSerialNumber: string | null;
  sensorModel: SensorModel | null;
  condition: ConditionKind;
  freshness: FreshnessKind;
  /** RMS radial (Y/Z pareados) da aquisição mais recente da janela. */
  currentValue: number | null;
  baselineValue: number | null;
  deviationRatio: number | null;
  currentAt: string | null;
  baselineAt: string | null;
  currentSampleCount: number | null;
  currentCycleId: string | null;
  baselineCycleId: string | null;
  unit: string;
}

export interface FleetConditionResponseDto {
  from: string;
  to: string;
  generatedAt: string;
  points: FleetConditionPoint[];
}

/** Ponto de uma série já agregado no banco — a unidade que os gráficos consomem. */
export interface SeriesBucketPoint {
  bucketStart: string;
  sampleCount: number;
  acquisitionCount: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  lastAt: string | null;
}

export interface SeriesPointsResponseDto {
  seriesId: string;
  from: string;
  to: string;
  bucket: string;
  /** Estatísticas da janela inteira, calculadas no banco. */
  stats: {
    sampleCount: number;
    acquisitionCount: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    firstAt: string | null;
    lastAt: string | null;
  };
  points: SeriesBucketPoint[];
}

/** Célula do mapa de atividade: um bucket temporal com cobertura da frota. */
export interface HeatmapBucketDto {
  bucketStart: string;
  bucketEnd: string;
  day: string;
  hour: number;
  sampleCount: number;
  acquisitionCount: number;
  reportingSensors: number;
  expectedSensors: number;
  coveragePercent: number;
}

export interface HeatmapResponseDto {
  from: string;
  to: string;
  bucket: string;
  expectedSensors: number;
  buckets: HeatmapBucketDto[];
}

/** Linha da janela temporal: o que um sensor fez no intervalo investigado. */
export interface TimeWindowSensorDto {
  sensorSerialNumber: string;
  sensorModel: SensorModel;
  seriesId: string;
  machineName: string | null;
  machineType: MachineType | null;
  monitoringPointId: string | null;
  monitoringPointName: string | null;
  sampleCount: number;
  acquisitionCount: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  lastValue: number | null;
  lastAt: string | null;
  unit: string;
}

export interface TimeWindowResponseDto {
  from: string;
  to: string;
  kpis: {
    reportingSensors: number;
    silentSensors: number;
    expectedSensors: number;
    acquisitionCount: number;
    sampleCount: number;
    maxValue: number | null;
    maxValueSensor: string | null;
  };
  items: TimeWindowSensorDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Uma aquisição (ciclo de ingestão) na listagem do sensor. */
export interface AcquisitionListItemDto {
  cycleId: string;
  externalCycleId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  rpm: number | null;
  loadPercent: number | null;
  scenario: string | null;
  sampleCount: number;
  anchorSampleCount: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  event: string | null;
  expectedState: string | null;
  unit: string;
}

export interface AcquisitionPageDto {
  serialNumber: string;
  from: string;
  to: string;
  items: AcquisitionListItemDto[];
  page: number;
  pageSize: number;
  /** `null` quando não foi pedido (`includeTotal=false`): a contagem custa uma varredura. */
  total: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
}

/** Resumo de uma série dentro de uma aquisição. */
export interface AcquisitionSeriesSummaryDto {
  seriesId: string;
  physicalQuantity: PhysicalQuantity;
  axis: Axis | null;
  unit: string;
  sampleCount: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  rms: number | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface AcquisitionDetailDto {
  cycleId: string;
  externalCycleId: string | null;
  sensorSerialNumber: string;
  sensorModel: SensorModel | null;
  machineName: string | null;
  monitoringPointName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  rpm: number | null;
  loadPercent: number | null;
  scenario: string | null;
  origin: string;
  tags: string[];
  ingestedAt: string;
  sampleCount: number;
  measurementCount: number;
  groundTruth: Record<string, unknown> | null;
  series: AcquisitionSeriesSummaryDto[];
}

/** Amostra bruta — o nível folha, alcançado só sob pedido explícito. */
export interface RawSampleDto {
  id: string;
  timestamp: string;
  value: number;
  physicalQuantity: PhysicalQuantity;
  axis: Axis | null;
  unit: string;
}

export interface RawSamplePageDto {
  cycleId: string;
  items: RawSampleDto[];
  limit: number;
  /** Cursor keyset da próxima página; `null` quando acabou. */
  nextCursor: string | null;
  quantity: string | null;
  axis: string | null;
}
