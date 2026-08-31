/**
 * Modelos de resposta expostos no OpenAPI.
 *
 * São classes (e não interfaces) porque o gerador do Swagger lê metadados em tempo de
 * execução: só assim cada rota publica um schema navegável, com exemplos, em vez de uma
 * frase descrevendo o formato. Os tipos de domínio continuam sendo a fonte de verdade —
 * estas classes existem para descrevê-los no contrato público.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ISO = '2026-08-31T08:00:00.000Z';

export class ErrorResponse {
  @ApiProperty({
    description: 'Código estável do erro; use-o para tratar o caso, não a mensagem.',
    example: 'MACHINE_NAME_CONFLICT',
  })
  code!: string;

  @ApiProperty({
    description: 'Mensagem legível, sujeita a mudanças de redação.',
    example: 'Já existe uma máquina com este nome.',
  })
  message!: string;

  /**
   * Alguns erros da ingestão acrescentam contexto para que o produtor corrija o payload
   * sem adivinhar. `code` e `message` estão sempre presentes; estes campos, não.
   */
  @ApiPropertyOptional({
    description: 'Violações do contrato de telemetria (CONTRACT_VIOLATION).',
    type: 'array',
    items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } },
  })
  violations?: Array<{ path: string; message: string }>;

  @ApiPropertyOptional({
    description: 'Série envolvida no conflito (SAMPLE_TIMESTAMP_CONFLICT, SERIES_UNIT_CONFLICT).',
    format: 'uuid',
    type: String,
  })
  timeSeriesId?: string;

  @ApiPropertyOptional({
    description: 'Instantes que já existiam na série (SAMPLE_TIMESTAMP_CONFLICT).',
    type: [String],
    example: ['2026-09-10T12:00:00.000Z'],
  })
  conflictingTimestamps?: string[];
}

export class SessionUserResponse {
  @ApiProperty({ format: 'uuid', example: 'e296fc5c-c2b1-4941-b363-0ee813b213e1' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'analista@dynamox.local' })
  email!: string;

  @ApiProperty({ example: 'Analista de Manutenção' })
  name!: string;

  @ApiProperty({
    enum: ['ADMIN', 'VIEWER'],
    description:
      'ADMIN consulta e altera; VIEWER apenas consulta — mutações respondem 403 para ele.',
    example: 'ADMIN',
  })
  role!: 'ADMIN' | 'VIEWER';
}

export class LoginResponse {
  @ApiProperty({
    description: 'JWT para o header Authorization: Bearer <token>.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMjk2ZmM1Yy...',
  })
  token!: string;

  @ApiProperty({ type: SessionUserResponse })
  user!: SessionUserResponse;
}

export class HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: 'ok' | 'degraded';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  database!: 'up' | 'down';

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({ format: 'date-time', example: ISO })
  timestamp!: string;
}

export class MachineResponse {
  @ApiProperty({ format: 'uuid', example: '6f3d4a1e-9c2b-4f7a-8d51-0b2f1c9e7a10' })
  id!: string;

  @ApiProperty({ maxLength: 120, example: 'P-101' })
  name!: string;

  @ApiProperty({
    enum: ['Pump', 'Fan'],
    description: 'Máquinas Pump recusam sensores TcAg e TcAs.',
    example: 'Pump',
  })
  type!: 'Pump' | 'Fan';

  @ApiProperty({ format: 'date-time', example: ISO })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: ISO })
  updatedAt!: string;
}

export class SensorResponse {
  @ApiProperty({ format: 'uuid', example: '2b7c1f80-5a44-4c0e-9d3b-77e1a5c6d200' })
  id!: string;

  @ApiProperty({
    description: 'Identificador único do sensor em toda a instalação.',
    maxLength: 60,
    example: 'SIM-HF-001',
  })
  serialNumber!: string;

  @ApiProperty({ enum: ['TcAg', 'TcAs', 'HF+'], example: 'HF+' })
  model!: 'TcAg' | 'TcAs' | 'HF+';
}

export class MonitoringPointMachineResponse {
  @ApiProperty({ format: 'uuid', example: '6f3d4a1e-9c2b-4f7a-8d51-0b2f1c9e7a10' })
  id!: string;

  @ApiProperty({ example: 'P-101' })
  name!: string;

  @ApiProperty({ enum: ['Pump', 'Fan'], example: 'Pump' })
  type!: 'Pump' | 'Fan';
}

export class MonitoringPointResponse {
  @ApiProperty({ format: 'uuid', example: 'c81a55f2-3f0d-4a2b-93a6-1d5e2f4b8c33' })
  id!: string;

  @ApiProperty({ maxLength: 120, example: 'Mancal lado acoplamento' })
  name!: string;

  @ApiProperty({ type: MonitoringPointMachineResponse })
  machine!: MonitoringPointMachineResponse;

  @ApiProperty({
    type: SensorResponse,
    nullable: true,
    description: 'Cada ponto aceita no máximo um sensor; null quando ainda não há um.',
  })
  sensor!: SensorResponse | null;

  @ApiProperty({ format: 'date-time', example: ISO })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: ISO })
  updatedAt!: string;
}

export class MonitoringPointPageResponse {
  @ApiProperty({ type: [MonitoringPointResponse] })
  items!: MonitoringPointResponse[];

  @ApiProperty({
    description: 'Total de pontos no recorte pedido — não é o tamanho da tabela.',
    example: 12,
  })
  total!: number;

  @ApiProperty({ minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({
    description: 'A tela do desafio usa 5; a API aceita até 50 para consumo programático.',
    minimum: 1,
    maximum: 50,
    example: 5,
  })
  pageSize!: number;

  @ApiProperty({ description: 'Páginas do recorte, já arredondado para cima.', example: 3 })
  totalPages!: number;

  @ApiProperty({ enum: ['machineName', 'machineType', 'pointName', 'sensorModel'], example: 'machineName' })
  sortBy!: string;

  @ApiProperty({ enum: ['asc', 'desc'], example: 'asc' })
  sortDir!: 'asc' | 'desc';

  /**
   * `type` explícito é obrigatório nos campos anuláveis: o gerador lê o metadado de
   * runtime do TypeScript, e uma união com null chega como Object — o contrato sairia
   * publicando `type: object` para o que é, de fato, string.
   */
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Eco do recorte aplicado: confirma o que o servidor considerou.',
    example: null,
  })
  search!: string | null;

  @ApiProperty({ enum: ['Pump', 'Fan'], nullable: true, example: null })
  machineType!: 'Pump' | 'Fan' | null;

  @ApiProperty({ enum: ['TcAg', 'TcAs', 'HF+'], nullable: true, example: null })
  sensorModel!: 'TcAg' | 'TcAs' | 'HF+' | null;

  @ApiProperty({ type: Boolean, nullable: true, example: null })
  hasSensor!: boolean | null;
}

export class TimeSeriesSummaryResponse {
  @ApiProperty({ format: 'uuid', example: '3d3a56de-0fd7-4db9-84ea-5254bfd7b549' })
  id!: string;

  @ApiProperty({ example: 'P-101' })
  machineName!: string;

  @ApiProperty({ example: 'Mancal lado acoplamento' })
  monitoringPointName!: string;

  @ApiProperty({ example: 'SIM-HF-001' })
  sensorSerialNumber!: string;

  @ApiProperty({ enum: ['TcAg', 'TcAs', 'HF+'], example: 'HF+' })
  sensorModel!: string;

  @ApiProperty({
    enum: ['acceleration', 'velocity', 'temperature', 'rotationalSpeed'],
    example: 'acceleration',
  })
  physicalQuantity!: string;

  @ApiProperty({
    enum: ['x', 'y', 'z'],
    nullable: true,
    description: 'Grandezas escalares (temperatura, rotação) não têm eixo.',
    example: 'y',
  })
  axis!: string | null;

  @ApiProperty({ description: 'Unidade no vocabulário público.', example: 'g' })
  unit!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Total de amostras da série; null quando a listagem foi pedida sem contagem (withCounts=false).',
    example: 60,
  })
  sampleCount!: number | null;

  @ApiProperty({
    description:
      'Valor da amostra mais recente da série; null quando a série ainda não tem amostras.',
    type: Number,
    nullable: true,
    example: 0.0575,
  })
  lastValue!: number | null;

  @ApiProperty({
    description: 'Instante da amostra mais recente (UTC). null quando a série está vazia.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: ISO,
  })
  lastTimestamp!: string | null;
}

export class SeriesMetricsResponse {
  @ApiProperty({ example: 270 })
  count!: number;

  @ApiProperty({ type: Number, nullable: true, example: 0.0195 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 0.0324 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 0.0258 })
  avg!: number | null;

  @ApiProperty({
    type: Number,
    description: 'Valor da amostra mais recente.',
    nullable: true,
    example: 0.0303,
  })
  last!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: ISO })
  firstTimestamp!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-08-31T08:04:29.000Z',
  })
  lastTimestamp!: string | null;
}

export class TimeSeriesSampleResponse {
  @ApiProperty({ format: 'date-time', example: ISO })
  timestamp!: string;

  @ApiProperty({ example: 0.024681 })
  value!: number;
}

export class TimeSeriesSamplePageResponse {
  @ApiProperty({ type: [TimeSeriesSampleResponse] })
  items!: TimeSeriesSampleResponse[];

  @ApiProperty({ description: 'Total de amostras da série, ignorando a janela pedida.', example: 270 })
  total!: number;

  @ApiProperty({ minimum: 1, maximum: 5000, example: 500 })
  limit!: number;

  @ApiProperty({ minimum: 0, example: 0 })
  offset!: number;
}

export class TelemetryIngestionResponse {
  @ApiProperty({
    description:
      'true quando o ciclo já havia sido ingerido: a repetição é aceita (200) sem gravar de novo.',
    example: false,
  })
  duplicate!: boolean;

  @ApiProperty({
    description:
      'Identificador do ciclo persistido, gerado pela API. Não confundir com metadata.cycleId do payload, que é guardado como rastro do produtor.',
    format: 'uuid',
    example: 'abea2728-017c-4f0c-bfd4-cc522bee056d',
  })
  cycleId!: string;

  @ApiProperty({ description: 'Valor recebido no header Idempotency-Key.', example: 'sim.SIM-HF-001.normal.s42.20260831T080000Z.2a6e4f0c' })
  idempotencyKey!: string;

  @ApiProperty({
    description: 'SHA-256 canônico do conteúdo; igual para payloads equivalentes.',
    example: '6586e6345f9cbd4c1f0a...c2886055',
  })
  payloadFingerprint!: string;

  @ApiProperty({ example: 5 })
  measurementCount!: number;

  @ApiProperty({ example: 300 })
  sampleCount!: number;

  @ApiProperty({
    type: [String],
    description: 'Séries afetadas, criadas ou reutilizadas.',
    example: ['3d3a56de-0fd7-4db9-84ea-5254bfd7b549'],
  })
  timeSeriesIds!: string[];
}

// ————— Analytics —————

export class TrendPointResponse {
  @ApiProperty({ format: 'date-time', description: 'Início do bucket agregado.', example: ISO })
  timestamp!: string;

  @ApiProperty({ description: 'RMS do eixo âncora no bucket.', example: 0.0171 })
  value!: number;
}

export class FleetConditionPointResponse {
  @ApiProperty({ description: 'Máquina do ponto.', example: 'P-101' })
  machineName!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Tipo público da máquina.', example: 'Pump' })
  machineType!: string | null;

  @ApiProperty({ format: 'uuid', description: 'Identificador do ponto de monitoramento.' })
  monitoringPointId!: string;

  @ApiProperty({ description: 'Nome do ponto.', example: 'Mancal lado oposto ao acoplamento' })
  monitoringPointName!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Sensor associado, quando existe.', example: 'SIM-HF-002' })
  sensorSerialNumber!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Modelo público do sensor.', example: 'HF+' })
  sensorModel!: string | null;

  @ApiProperty({
    description: 'Classificação demonstrativa (limiares didáticos 1,5x e 2,0x).',
    enum: ['normal', 'observation', 'attention', 'unclassified', 'no-data', 'no-sensor'],
    example: 'attention',
  })
  condition!: string;

  @ApiProperty({
    description: 'Recência da última leitura (24 h para desatualizado, 5 min de tolerância no futuro).',
    enum: ['current', 'stale', 'future', 'unknown'],
    example: 'current',
  })
  freshness!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS radial (Y/Z) da aquisição mais recente da janela.', example: 0.0571 })
  currentValue!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS radial da aquisição de referência da janela.', example: 0.0164 })
  baselineValue!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Razão entre a aquisição atual e a de referência.', example: 3.49 })
  deviationRatio!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da aquisição atual.', example: ISO })
  currentAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da aquisição de referência.', example: ISO })
  baselineAt!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Amostras da aquisição atual no eixo âncora.', example: 60 })
  currentSampleCount!: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Ciclo de ingestão da aquisição atual.' })
  currentCycleId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Ciclo de ingestão da aquisição de referência.' })
  baselineCycleId!: string | null;

  @ApiProperty({ description: 'Unidade das grandezas radiais.', example: 'g' })
  unit!: string;

  @ApiProperty({
    type: [TrendPointResponse],
    description:
      'Tendência curta (até 12 buckets das últimas 24 h da janela). Vazia sem includeTrend=true.',
  })
  trend!: TrendPointResponse[];
}

export class FleetConditionResponse {
  @ApiProperty({ format: 'date-time', description: 'Início da janela consultada.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela consultada.', example: ISO })
  to!: string;

  @ApiProperty({ format: 'date-time', description: 'Instante da avaliação (base da recência).', example: ISO })
  generatedAt!: string;

  @ApiProperty({ type: [FleetConditionPointResponse], description: 'Um item por ponto de monitoramento.' })
  points!: FleetConditionPointResponse[];
}

export class SeriesBucketPointResponse {
  @ApiProperty({ format: 'date-time', description: 'Início do bucket.', example: ISO })
  bucketStart!: string;

  @ApiProperty({ description: 'Amostras agregadas no bucket.', example: 900 })
  sampleCount!: number;

  @ApiProperty({ description: 'Aquisições distintas no bucket.', example: 15 })
  acquisitionCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Média do bucket.', example: 0.0164 })
  avg!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo do bucket.', example: 0.0121 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo do bucket.', example: 0.0208 })
  max!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Última amostra do bucket.', example: ISO })
  lastAt!: string | null;
}

export class SeriesWindowStatsResponse {
  @ApiProperty({ description: 'Amostras na janela.', example: 40320 })
  sampleCount!: number;

  @ApiProperty({ description: 'Aquisições na janela.', example: 672 })
  acquisitionCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo da janela.', example: 0.0119 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo da janela.', example: 0.0611 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Média da janela.', example: 0.0177 })
  avg!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Primeira amostra da janela.', example: ISO })
  firstAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Última amostra da janela.', example: ISO })
  lastAt!: string | null;
}

export class SeriesPointsResponse {
  @ApiProperty({ format: 'uuid', description: 'Série consultada.' })
  seriesId!: string;

  @ApiProperty({ format: 'date-time', description: 'Início da janela.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela.', example: ISO })
  to!: string;

  @ApiProperty({ description: 'Bucket aplicado.', enum: ['15m', '1h', '4h', '1d'], example: '1h' })
  bucket!: string;

  @ApiProperty({ type: SeriesWindowStatsResponse, description: 'Estatísticas da janela inteira.' })
  stats!: SeriesWindowStatsResponse;

  @ApiProperty({ type: [SeriesBucketPointResponse], description: 'Pontos agregados, em ordem cronológica.' })
  points!: SeriesBucketPointResponse[];
}

export class HeatmapBucketResponse {
  @ApiProperty({ format: 'date-time', description: 'Início do bucket.', example: ISO })
  bucketStart!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo do bucket.', example: ISO })
  bucketEnd!: string;

  @ApiProperty({ description: 'Dia do bucket (UTC).', example: '2026-08-30' })
  day!: string;

  @ApiProperty({ description: 'Hora do bucket (0–23; 0 quando o bucket é diário).', example: 14 })
  hour!: number;

  @ApiProperty({ description: 'Amostras persistidas no bucket.', example: 720 })
  sampleCount!: number;

  @ApiProperty({ description: 'Aquisições no bucket.', example: 12 })
  acquisitionCount!: number;

  @ApiProperty({ description: 'Sensores que reportaram no bucket.', example: 12 })
  reportingSensors!: number;

  @ApiProperty({ description: 'Sensores esperados (instrumentados).', example: 12 })
  expectedSensors!: number;

  @ApiProperty({ description: 'Cobertura do bucket em porcentagem.', example: 100 })
  coveragePercent!: number;
}

export class HeatmapResponse {
  @ApiProperty({ format: 'date-time', description: 'Início da janela.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela.', example: ISO })
  to!: string;

  @ApiProperty({ description: 'Granularidade das células.', enum: ['hour', 'day'], example: 'hour' })
  bucket!: string;

  @ApiProperty({ description: 'Sensores instrumentados considerados na cobertura.', example: 12 })
  expectedSensors!: number;

  @ApiProperty({ type: [HeatmapBucketResponse], description: 'Células com atividade, em ordem cronológica.' })
  buckets!: HeatmapBucketResponse[];
}

export class TimeWindowSensorResponse {
  @ApiProperty({ description: 'Sensor.', example: 'SIM-HF-002' })
  sensorSerialNumber!: string;

  @ApiProperty({ description: 'Modelo público.', example: 'HF+' })
  sensorModel!: string;

  @ApiProperty({ format: 'uuid', description: 'Série âncora (aceleração Y) usada no resumo.' })
  seriesId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Máquina.', example: 'P-101' })
  machineName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Tipo da máquina.', example: 'Pump' })
  machineType!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid', description: 'Ponto de monitoramento.' })
  monitoringPointId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Nome do ponto.', example: 'Mancal lado acoplamento' })
  monitoringPointName!: string | null;

  @ApiProperty({ description: 'Amostras da série âncora na janela.', example: 180 })
  sampleCount!: number;

  @ApiProperty({ description: 'Aquisições na janela.', example: 3 })
  acquisitionCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo na janela.', example: 0.0121 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo na janela.', example: 0.0611 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Média na janela.', example: 0.0164 })
  avg!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Última leitura da janela.', example: 0.0166 })
  lastValue!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da última leitura.', example: ISO })
  lastAt!: string | null;

  @ApiProperty({ description: 'Unidade.', example: 'g' })
  unit!: string;
}

export class TimeWindowKpisResponse {
  @ApiProperty({ description: 'Sensores que reportaram na janela.', example: 12 })
  reportingSensors!: number;

  @ApiProperty({ description: 'Sensores sem leitura na janela.', example: 0 })
  silentSensors!: number;

  @ApiProperty({ description: 'Sensores instrumentados.', example: 12 })
  expectedSensors!: number;

  @ApiProperty({ description: 'Aquisições na janela.', example: 48 })
  acquisitionCount!: number;

  @ApiProperty({ description: 'Amostras da janela (séries âncora).', example: 2880 })
  sampleCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Maior valor observado.', example: 0.0611 })
  maxValue!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Sensor do maior valor.', example: 'SIM-HF-002' })
  maxValueSensor!: string | null;
}

export class TimeWindowResponse {
  @ApiProperty({ format: 'date-time', description: 'Início da janela.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela.', example: ISO })
  to!: string;

  @ApiProperty({ type: TimeWindowKpisResponse, description: 'Indicadores da janela.' })
  kpis!: TimeWindowKpisResponse;

  @ApiProperty({ type: [TimeWindowSensorResponse], description: 'Página de sensores.' })
  items!: TimeWindowSensorResponse[];

  @ApiProperty({ description: 'Total de sensores considerados.', example: 12 })
  total!: number;

  @ApiProperty({ description: 'Página corrente.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Itens por página.', example: 25 })
  pageSize!: number;

  @ApiProperty({ description: 'Total de páginas.', example: 1 })
  totalPages!: number;
}

export class AcquisitionListItemResponse {
  @ApiProperty({ format: 'uuid', description: 'Ciclo de ingestão que representa a aquisição.' })
  cycleId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Identificador declarado pelo produtor.', example: 'sim.SIM-HF-002.normal.s42.20260830T140200Z.0cbbf495' })
  externalCycleId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Início do dado.', example: ISO })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Fim do dado.', example: ISO })
  endedAt!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Duração em segundos.', example: 60 })
  durationSeconds!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Rotação declarada.', example: 1750 })
  rpm!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Carga declarada (%).', example: 74.1 })
  loadPercent!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cenário declarado pelo produtor.', example: 'normal' })
  scenario!: string | null;

  @ApiProperty({ description: 'Amostras do ciclo (todas as séries).', example: 300 })
  sampleCount!: number;

  @ApiProperty({ description: 'Amostras da série âncora.', example: 60 })
  anchorSampleCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo da série âncora.', example: 0.0121 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo da série âncora.', example: 0.0611 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Média da série âncora.', example: 0.0164 })
  avg!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Evento declarado na verdade-terreno.', example: 'imbalance' })
  event!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Estado esperado na verdade-terreno.', example: 'observation' })
  expectedState!: string | null;

  @ApiProperty({ description: 'Unidade da série âncora.', example: 'g' })
  unit!: string;
}

export class AcquisitionPageResponse {
  @ApiProperty({ description: 'Sensor consultado.', example: 'SIM-HF-002' })
  serialNumber!: string;

  @ApiProperty({ format: 'date-time', description: 'Início da janela.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela.', example: ISO })
  to!: string;

  @ApiProperty({ type: [AcquisitionListItemResponse], description: 'Aquisições da página, mais recentes primeiro.' })
  items!: AcquisitionListItemResponse[];

  @ApiProperty({ description: 'Página corrente.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Itens por página.', example: 25 })
  pageSize!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Total de aquisições; null quando não solicitado.', example: null })
  total!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Total de páginas; null quando o total não foi solicitado.', example: null })
  totalPages!: number | null;

  @ApiProperty({ description: 'Existe página seguinte.', example: true })
  hasNextPage!: boolean;
}

export class AcquisitionSeriesSummaryResponse {
  @ApiProperty({ format: 'uuid', description: 'Série.' })
  seriesId!: string;

  @ApiProperty({ description: 'Grandeza física.', example: 'acceleration' })
  physicalQuantity!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Eixo; nulo em grandezas escalares.', example: 'y' })
  axis!: string | null;

  @ApiProperty({ description: 'Unidade.', example: 'g' })
  unit!: string;

  @ApiProperty({ description: 'Amostras da série nesta aquisição.', example: 60 })
  sampleCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo.', example: 0.0121 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo.', example: 0.0611 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Média.', example: 0.0164 })
  avg!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS da aquisição.', example: 0.0172 })
  rms!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Primeira amostra.', example: ISO })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Última amostra.', example: ISO })
  endedAt!: string | null;
}

export class AcquisitionDetailResponse {
  @ApiProperty({ format: 'uuid', description: 'Ciclo de ingestão.' })
  cycleId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Identificador do produtor.' })
  externalCycleId!: string | null;

  @ApiProperty({ description: 'Sensor.', example: 'SIM-HF-002' })
  sensorSerialNumber!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Modelo público.', example: 'HF+' })
  sensorModel!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Máquina.', example: 'P-101' })
  machineName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Ponto.', example: 'Mancal lado oposto ao acoplamento' })
  monitoringPointName!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Início do dado.', example: ISO })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Fim do dado.', example: ISO })
  endedAt!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Duração em segundos.', example: 60 })
  durationSeconds!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Rotação declarada.', example: 1750 })
  rpm!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Carga declarada.', example: 74.1 })
  loadPercent!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Cenário declarado.', example: 'normal' })
  scenario!: string | null;

  @ApiProperty({ description: 'Origem da ingestão.', example: 'SIMULATION' })
  origin!: string;

  @ApiProperty({ type: [String], description: 'Tags do ciclo.', example: ['simulated', 'dataset:history'] })
  tags!: string[];

  @ApiProperty({ format: 'date-time', description: 'Instante da ingestão.', example: ISO })
  ingestedAt!: string;

  @ApiProperty({ description: 'Amostras do ciclo.', example: 300 })
  sampleCount!: number;

  @ApiProperty({ description: 'Medições do ciclo.', example: 5 })
  measurementCount!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Verdade-terreno declarada pelo gerador sintético, quando existe.',
  })
  groundTruth!: Record<string, unknown> | null;

  @ApiProperty({ type: [AcquisitionSeriesSummaryResponse], description: 'Resumo por série.' })
  series!: AcquisitionSeriesSummaryResponse[];
}

export class RawSampleResponse {
  @ApiProperty({ format: 'uuid', description: 'Identificador da amostra.' })
  id!: string;

  @ApiProperty({ format: 'date-time', description: 'Instante da amostra.', example: ISO })
  timestamp!: string;

  @ApiProperty({ description: 'Valor medido.', example: 0.0164 })
  value!: number;

  @ApiProperty({ description: 'Grandeza física.', example: 'acceleration' })
  physicalQuantity!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Eixo.', example: 'y' })
  axis!: string | null;

  @ApiProperty({ description: 'Unidade.', example: 'g' })
  unit!: string;
}

export class RawSamplePageResponse {
  @ApiProperty({ format: 'uuid', description: 'Aquisição consultada.' })
  cycleId!: string;

  @ApiProperty({ type: [RawSampleResponse], description: 'Amostras da página, em ordem cronológica.' })
  items!: RawSampleResponse[];

  @ApiProperty({ description: 'Limite aplicado.', example: 500 })
  limit!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Cursor da próxima página; null quando acabou.', example: null })
  nextCursor!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Filtro de grandeza aplicado.', example: null })
  quantity!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Filtro de eixo aplicado.', example: null })
  axis!: string | null;
}

export class MachinePointSummaryResponse {
  @ApiProperty({ format: 'uuid', description: 'Identificador do ponto de monitoramento.' })
  monitoringPointId!: string;

  @ApiProperty({ description: 'Nome do ponto.', example: 'Mancal lado oposto ao acoplamento' })
  monitoringPointName!: string;

  @ApiProperty({ description: 'Segmento de URL do ponto dentro do ativo.', example: 'mancal-lado-acoplamento' })
  slug!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Sensor associado.', example: 'SIM-HF-002' })
  sensorSerialNumber!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Modelo público do sensor.', example: 'HF+' })
  sensorModel!: string | null;

  @ApiProperty({
    description: 'Classificação demonstrativa do ponto.',
    enum: ['normal', 'observation', 'attention', 'unclassified', 'no-data', 'no-sensor'],
    example: 'attention',
  })
  condition!: string;

  @ApiProperty({
    description: 'Recência da última leitura.',
    enum: ['current', 'stale', 'future', 'unknown'],
    example: 'current',
  })
  freshness!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS radial da aquisição atual.', example: 0.0571 })
  currentValue!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS radial da aquisição de referência.', example: 0.0164 })
  baselineValue!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Razão entre atual e referência.', example: 3.49 })
  deviationRatio!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Última leitura conhecida do ponto.', example: ISO })
  lastAt!: string | null;

  @ApiProperty({ description: 'Aquisições do ponto na janela.', example: 672 })
  acquisitionCount!: number;

  @ApiProperty({ description: 'Amostras da série âncora na janela.', example: 40320 })
  sampleCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo da janela.', example: 0.0121 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo da janela.', example: 0.0611 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Média da janela.', example: 0.0187 })
  avg!: number | null;

  @ApiProperty({ description: 'Unidade das grandezas radiais.', example: 'g' })
  unit!: string;

  @ApiProperty({ type: [TrendPointResponse], description: 'Tendência curta do ponto.' })
  trend!: TrendPointResponse[];
}

export class MachineKpisResponse {
  @ApiProperty({ description: 'Pontos de monitoramento do ativo.', example: 2 })
  points!: number;

  @ApiProperty({ description: 'Pontos com sensor instalado.', example: 2 })
  sensors!: number;

  @ApiProperty({ description: 'Pontos em atenção ou observação.', example: 1 })
  attention!: number;

  @ApiProperty({ description: 'Aquisições do ativo na janela.', example: 1344 })
  acquisitionCount!: number;

  @ApiProperty({ description: 'Percentual de pontos que reportaram na janela.', example: 100 })
  coveragePercent!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Maior razão observada no ativo.', example: 3.49 })
  maxDeviationRatio!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Ponto de maior razão.', example: 'Mancal lado oposto ao acoplamento' })
  maxDeviationPoint!: string | null;
}

export class MachineSummaryResponse {
  @ApiProperty({ format: 'uuid', description: 'Identificador da máquina.' })
  machineId!: string;

  @ApiProperty({ description: 'Nome cadastrado da máquina.', example: 'P-101' })
  machineName!: string;

  @ApiProperty({ description: 'Tipo público da máquina.', enum: ['Pump', 'Fan'], example: 'Pump' })
  machineType!: string;

  @ApiProperty({ description: 'Segmento de URL do ativo.', example: 'P-101' })
  slug!: string;

  @ApiProperty({ format: 'date-time', description: 'Início da janela.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela.', example: ISO })
  to!: string;

  @ApiProperty({ type: MachineKpisResponse, description: 'Indicadores do ativo na janela.' })
  kpis!: MachineKpisResponse;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Última leitura do ativo.', example: ISO })
  lastAt!: string | null;

  @ApiProperty({ type: [MachinePointSummaryResponse], description: 'Um item por ponto do ativo.' })
  points!: MachinePointSummaryResponse[];
}

export class PointSeriesResponse {
  @ApiProperty({ format: 'uuid', description: 'Identificador da série temporal.' })
  seriesId!: string;

  @ApiProperty({
    description: 'Grandeza pública da série.',
    enum: ['acceleration', 'velocity', 'temperature', 'rotationalSpeed'],
    example: 'acceleration',
  })
  physicalQuantity!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Eixo público; nulo em grandezas escalares.', enum: ['x', 'y', 'z'], example: 'y' })
  axis!: string | null;

  @ApiProperty({ description: 'Unidade da série.', example: 'g' })
  unit!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Última leitura da série na janela.', example: 0.0171 })
  lastValue!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da última leitura na janela.', example: ISO })
  lastAt!: string | null;
}

export class PointWindowResponse {
  @ApiProperty({ description: 'Aquisições na janela.', example: 672 })
  acquisitionCount!: number;

  @ApiProperty({ description: 'Amostras da série âncora na janela.', example: 40320 })
  sampleCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Mínimo da janela.', example: 0.0121 })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Máximo da janela.', example: 0.0611 })
  max!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Média da janela.', example: 0.0187 })
  avg!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Último valor da janela.', example: 0.0171 })
  lastValue!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da última leitura.', example: ISO })
  lastAt!: string | null;
}

export class PointSummaryResponse {
  @ApiProperty({ format: 'uuid', description: 'Identificador da máquina.' })
  machineId!: string;

  @ApiProperty({ description: 'Nome cadastrado da máquina.', example: 'P-101' })
  machineName!: string;

  @ApiProperty({ description: 'Tipo público da máquina.', enum: ['Pump', 'Fan'], example: 'Pump' })
  machineType!: string;

  @ApiProperty({ description: 'Segmento de URL do ativo.', example: 'P-101' })
  machineSlug!: string;

  @ApiProperty({ format: 'uuid', description: 'Identificador do ponto.' })
  monitoringPointId!: string;

  @ApiProperty({ description: 'Nome do ponto.', example: 'Mancal lado oposto ao acoplamento' })
  monitoringPointName!: string;

  @ApiProperty({ description: 'Segmento de URL do ponto.', example: 'mancal-lado-oposto-ao-acoplamento' })
  slug!: string;

  @ApiProperty({ format: 'date-time', description: 'Início da janela.', example: ISO })
  from!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim exclusivo da janela.', example: ISO })
  to!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Sensor associado ao ponto.', example: 'SIM-HF-002' })
  sensorSerialNumber!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Modelo público do sensor.', example: 'HF+' })
  sensorModel!: string | null;

  @ApiProperty({
    description: 'Classificação demonstrativa do ponto.',
    enum: ['normal', 'observation', 'attention', 'unclassified', 'no-data', 'no-sensor'],
    example: 'attention',
  })
  condition!: string;

  @ApiProperty({
    description: 'Recência da última leitura.',
    enum: ['current', 'stale', 'future', 'unknown'],
    example: 'current',
  })
  freshness!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS radial da aquisição atual.', example: 0.0571 })
  currentValue!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'RMS radial da aquisição de referência.', example: 0.0164 })
  baselineValue!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Razão entre atual e referência.', example: 3.49 })
  deviationRatio!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da aquisição atual.', example: ISO })
  currentAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Instante da aquisição de referência.', example: ISO })
  baselineAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Ciclo da aquisição atual.' })
  currentCycleId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Ciclo da aquisição de referência.' })
  baselineCycleId!: string | null;

  @ApiProperty({ description: 'Unidade das grandezas radiais.', example: 'g' })
  unit!: string;

  @ApiProperty({ type: PointWindowResponse, description: 'Agregados da janela consultada.' })
  window!: PointWindowResponse;

  @ApiProperty({ type: [TrendPointResponse], description: 'Tendência curta do ponto.' })
  trend!: TrendPointResponse[];

  @ApiProperty({ type: [PointSeriesResponse], description: 'Séries disponíveis no ponto.' })
  series!: PointSeriesResponse[];
}
