import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type {
  SeriesMetrics,
  TimeSeriesSamplePage,
  TimeSeriesSummary,
} from '@dynamox/domain';

import {
  ErrorResponse,
  SeriesMetricsResponse,
  TelemetryIngestionResponse,
  TimeSeriesSamplePageResponse,
  TimeSeriesSummaryResponse,
} from '../common/api-schemas';
import { TelemetryService, type IngestionResult } from './telemetry.service';

const SAMPLES_QUERY_KEYS = ['limit', 'offset'] as const;
const MAX_SAMPLES_LIMIT = 5000;
const DEFAULT_SAMPLES_LIMIT = 500;
/** Teto do offset: além disso não há uso real e o valor só estressaria o banco. */
const MAX_SAMPLES_OFFSET = 10_000_000;

function invalidSamplesQuery(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_SAMPLES_QUERY', message });
}

function parseBoundedInt(
  value: unknown,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw invalidSamplesQuery(`O parâmetro "${field}" deve ser um inteiro não negativo.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw invalidSamplesQuery(
      `O parâmetro "${field}" deve estar entre ${min} e ${max}.`,
    );
  }
  return parsed;
}

/** Mesma filosofia dos outros módulos: parâmetro desconhecido é erro, não silêncio. */
export function parseSamplesQuery(query: Record<string, unknown>): { limit: number; offset: number } {
  const unknown = Object.keys(query).filter(
    (key) => !(SAMPLES_QUERY_KEYS as readonly string[]).includes(key),
  );
  if (unknown.length > 0) {
    throw invalidSamplesQuery(
      `Parâmetro(s) não suportado(s): ${unknown.join(', ')}. Aceitos: ${SAMPLES_QUERY_KEYS.join(', ')}.`,
    );
  }

  return {
    limit: parseBoundedInt(query.limit, 'limit', DEFAULT_SAMPLES_LIMIT, 1, MAX_SAMPLES_LIMIT),
    offset: parseBoundedInt(query.offset, 'offset', 0, 0, MAX_SAMPLES_OFFSET),
  };
}

@ApiBearerAuth('bearer')
@ApiResponse({ status: 401, description: 'Token ausente, inválido ou expirado', type: ErrorResponse })
@Controller()
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  /**
   * TS-06. A chave de idempotência chega pelo header porque telemetryCycleData declara
   * additionalProperties:false — nenhum campo novo pode ser acrescentado ao payload.
   * Quando o header não vem, a chave é derivada do próprio conteúdo do ciclo.
   */
  @Post('telemetry-cycles')
  @ApiResponse({
    status: 403,
    description: 'Perfil VIEWER: este endpoint altera estado e exige perfil administrador.',
    type: ErrorResponse,
  })
  @ApiTags('telemetry')
  @ApiOperation({
    summary: 'Ingestão idempotente de um ciclo de telemetria (contrato SCP-04)',
    description:
      'O corpo segue contracts/dynamox/telemetry-cycle.schema.json (additionalProperties: false). Repetir o mesmo conteúdo, com ou sem a mesma chave, devolve 200 duplicate:true sem gravar nada de novo.',
  })
  @ApiBody({
    description:
      'Ciclo de telemetria conforme contracts/dynamox/telemetry-cycle.schema.json. O exemplo abaixo é um ciclo mínimo válido: uma medição de aceleração no eixo Y com duas amostras.',
    schema: {
      type: 'object',
      required: ['telemetryCycleData', 'configuration'],
      additionalProperties: false,
      properties: {
        telemetryCycleData: {
          type: 'object',
          required: ['measuringSystemUniqueIdentifier', 'measuringSystemModel', 'measurements', 'metadata', 'tags'],
          properties: {
            measuringSystemUniqueIdentifier: {
              type: 'string',
              description: 'Série do sensor já associado a um ponto de monitoramento.',
              example: 'SIM-HF-001',
            },
            measuringSystemModel: {
              type: 'object',
              properties: { name: { type: 'string' }, version: { type: 'integer' } },
            },
            measurements: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['resourceId', 'attributes', 'dataPoints'],
                properties: {
                  resourceId: {
                    type: 'string',
                    description: 'Identificador determinístico do ponto (24 hex). Divergir dele responde 422 RESOURCE_ID_MISMATCH.',
                    example: '42d726ba50f8645df08dba9f',
                  },
                  attributes: {
                    type: 'object',
                    required: ['physicalQuantity', 'unit', 'displayName'],
                    properties: {
                      physicalQuantity: {
                        type: 'string',
                        enum: ['acceleration', 'velocity', 'temperature', 'rotationalSpeed'],
                      },
                      axis: {
                        type: 'string',
                        enum: ['x', 'y', 'z'],
                        description: 'Obrigatório em grandezas vetoriais; proibido nas escalares (422 QUANTITY_AXIS_MISMATCH).',
                      },
                      unit: { type: 'string', example: 'g' },
                      displayName: {
                        type: 'object',
                        properties: { pt: { type: 'string' }, en: { type: 'string' } },
                      },
                    },
                  },
                  dataPoints: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      required: ['timestamp', 'value'],
                      properties: {
                        timestamp: {
                          type: 'string',
                          format: 'date-time',
                          description: 'UTC canônico com milissegundos; outro formato responde 400 NON_CANONICAL_TIMESTAMP.',
                        },
                        value: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
            metadata: {
              type: 'object',
              required: ['origin', 'generator', 'cycleId', 'synthetic'],
              properties: {
                origin: { type: 'string', enum: ['simulation', 'rosbag-replay', 'seed', 'manual'] },
                generator: {
                  type: 'object',
                  properties: { name: { type: 'string' }, version: { type: 'string' } },
                },
                profile: { type: 'string', enum: ['TcAg', 'TcAs', 'HF+'] },
                cycleId: { type: 'string' },
                seed: { type: 'integer' },
                synthetic: { type: 'boolean' },
              },
            },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        configuration: {
          type: 'object',
          required: ['monitoringLocationMap', 'rpm', 'loadPercent', 'scenario', 'seed', 'durationSeconds', 'publishRateHz'],
          properties: {
            monitoringLocationMap: {
              type: 'array',
              items: {
                type: 'object',
                properties: { mapLabel: { type: 'string' }, mapValue: { type: 'string' } },
              },
            },
            rpm: { type: 'number', example: 1750 },
            loadPercent: { type: 'number', example: 70 },
            scenario: { type: 'string', enum: ['normal', 'imbalance'] },
            seed: { type: 'integer', example: 42 },
            durationSeconds: { type: 'number', example: 60 },
            publishRateHz: { type: 'number', example: 1 },
          },
        },
      },
    },
    examples: {
      cicloMinimo: {
        summary: 'Ciclo mínimo válido (aceleração, eixo Y, 2 amostras)',
        value: {
          telemetryCycleData: {
            measuringSystemUniqueIdentifier: 'SIM-HF-001',
            measuringSystemModel: { name: 'industrial-condition-sensor-sim', version: 1 },
            measurements: [
              {
                resourceId: '42d726ba50f8645df08dba9f',
                attributes: {
                  physicalQuantity: 'acceleration',
                  axis: 'y',
                  unit: 'g',
                  displayName: { pt: 'Aceleração RMS — eixo Y', en: 'Acceleration RMS — Y axis' },
                },
                dataPoints: [
                  { timestamp: '2026-09-02T12:00:00.000Z', value: 0.024681 },
                  { timestamp: '2026-09-02T12:00:01.000Z', value: 0.025102 },
                ],
              },
            ],
            metadata: {
              origin: 'simulation',
              generator: { name: 'industrial-condition-sensor-sim', version: '0.2.0' },
              profile: 'HF+',
              cycleId: 'exemplo.swagger.001',
              seed: 42,
              synthetic: true,
            },
            tags: ['simulated', 'asset:p-101'],
          },
          configuration: {
            monitoringLocationMap: [
              { mapLabel: 'P-101 / Mancal lado acoplamento', mapValue: '42d726ba50f8645df08dba9f' },
            ],
            rpm: 1750,
            loadPercent: 70,
            scenario: 'normal',
            seed: 42,
            durationSeconds: 2,
            publishRateHz: 1,
          },
        },
      },
    },
  })
  @ApiHeader({
    // O nome precisa bater com o de @Headers() abaixo: com outra caixa, o gerador
    // publica DOIS parâmetros — e o inferido nasce como obrigatório, que é falso.
    name: 'idempotency-key',
    required: false,
    description: '1–128 caracteres [A-Za-z0-9._~:-]; sem o header, o fingerprint do payload vira a chave',
  })
  @ApiResponse({ status: 201, description: 'Ciclo novo persistido.', type: TelemetryIngestionResponse })
  @ApiResponse({
    status: 200,
    description: 'Repetição legítima do mesmo conteúdo: `duplicate: true` e o resultado original, sem gravar de novo.',
    type: TelemetryIngestionResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'CONTRACT_VIOLATION | INVALID_IDEMPOTENCY_KEY | NON_CANONICAL_TIMESTAMP',
    type: ErrorResponse,
  })
  @ApiResponse({ status: 404, description: 'SENSOR_NOT_FOUND', type: ErrorResponse })
  @ApiResponse({
    status: 409,
    description: 'IDEMPOTENCY_KEY_REUSED (mesma chave, conteúdo diferente) | SAMPLE_TIMESTAMP_CONFLICT | SERIES_UNIT_CONFLICT',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 422,
    description: 'QUANTITY_AXIS_MISMATCH | RESOURCE_ID_MISMATCH | SENSOR_NOT_ASSOCIATED',
    type: ErrorResponse,
  })
  async ingest(
    @Body() payload: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<IngestionResult> {
    const result = await this.telemetry.ingestCycle(payload, idempotencyKey);
    response.status(result.duplicate ? HttpStatus.OK : HttpStatus.CREATED);
    response.setHeader('Idempotency-Key', result.idempotencyKey);
    return result;
  }

  @Get('time-series')
  @ApiTags('time-series')
  @ApiOperation({ summary: 'Séries persistidas com máquina, ponto, sensor e contagem' })
  @ApiResponse({ status: 200, description: 'Séries existentes.', type: [TimeSeriesSummaryResponse] })
  listTimeSeries(): Promise<TimeSeriesSummary[]> {
    return this.telemetry.listTimeSeries();
  }

  /** TS-03: página de amostras com total — a série inteira é recuperável por offset. */
  @Get('time-series/:id/samples')
  @ApiTags('time-series')
  @ApiOperation({
    summary: 'Amostras paginadas por offset, ordenadas por instante',
    description: 'Resposta { items, total, limit, offset }: a série inteira é recuperável, nada é truncado em silêncio.',
  })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 5000, default: 500 } })
  @ApiQuery({ name: 'offset', required: false, schema: { type: 'integer', minimum: 0, default: 0 } })
  @ApiResponse({
    status: 200,
    description: 'Página de amostras; `total` é o tamanho da série inteira.',
    type: TimeSeriesSamplePageResponse,
  })
  @ApiResponse({ status: 400, description: 'INVALID_SAMPLES_QUERY', type: ErrorResponse })
  @ApiResponse({ status: 404, description: 'TIME_SERIES_NOT_FOUND', type: ErrorResponse })
  getSamples(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<TimeSeriesSamplePage> {
    return this.telemetry.getSamplesPage(id, parseSamplesQuery(query));
  }

  @Get('time-series/:id/metrics')
  @ApiTags('time-series')
  @ApiOperation({ summary: 'count, mínimo, máximo, média, último valor e janela' })
  @ApiResponse({
    status: 200,
    description: 'Métricas descritivas da série. Série vazia devolve count 0 e os demais campos null.',
    type: SeriesMetricsResponse,
  })
  @ApiResponse({ status: 404, description: 'TIME_SERIES_NOT_FOUND', type: ErrorResponse })
  getMetrics(@Param('id') id: string): Promise<SeriesMetrics> {
    return this.telemetry.getMetrics(id);
  }

  /** TS-05: remove a série e, em cascata, todas as suas amostras. */
  @Delete('time-series/:id')
  @ApiResponse({
    status: 403,
    description: 'Perfil VIEWER: este endpoint altera estado e exige perfil administrador.',
    type: ErrorResponse,
  })
  @ApiTags('time-series')
  @ApiOperation({ summary: 'Exclui a série e todas as suas amostras (cascata)' })
  @ApiResponse({ status: 204, description: 'Removida; resposta sem corpo.' })
  @ApiResponse({ status: 404, description: 'TIME_SERIES_NOT_FOUND', type: ErrorResponse })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTimeSeries(@Param('id') id: string): Promise<void> {
    return this.telemetry.removeTimeSeries(id);
  }
}
