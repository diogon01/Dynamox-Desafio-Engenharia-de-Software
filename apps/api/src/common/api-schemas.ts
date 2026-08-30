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

  @ApiProperty({ description: 'Quantidade de amostras armazenadas na série.', example: 270 })
  sampleCount!: number;

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
