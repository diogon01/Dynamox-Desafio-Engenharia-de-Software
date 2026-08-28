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
@ApiResponse({ status: 401, description: 'Token ausente, inválido ou expirado' })
@Controller()
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  /**
   * TS-06. A chave de idempotência chega pelo header porque telemetryCycleData declara
   * additionalProperties:false — nenhum campo novo pode ser acrescentado ao payload.
   * Quando o header não vem, a chave é derivada do próprio conteúdo do ciclo.
   */
  @Post('telemetry-cycles')
  @ApiTags('telemetry')
  @ApiOperation({
    summary: 'Ingestão idempotente de um ciclo de telemetria (contrato SCP-04)',
    description:
      'O corpo segue contracts/dynamox/telemetry-cycle.schema.json (additionalProperties: false). Repetir o mesmo conteúdo, com ou sem a mesma chave, devolve 200 duplicate:true sem gravar nada de novo.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: '1–128 caracteres [A-Za-z0-9._~:-]; sem o header, o fingerprint do payload vira a chave',
  })
  @ApiResponse({ status: 201, description: 'Ciclo novo persistido' })
  @ApiResponse({ status: 200, description: 'Repetição legítima: duplicate:true, resultado original' })
  @ApiResponse({ status: 400, description: 'CONTRACT_VIOLATION | INVALID_IDEMPOTENCY_KEY | NON_CANONICAL_TIMESTAMP' })
  @ApiResponse({ status: 404, description: 'SENSOR_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'IDEMPOTENCY_KEY_REUSED | SAMPLE_TIMESTAMP_CONFLICT | SERIES_UNIT_CONFLICT' })
  @ApiResponse({ status: 422, description: 'QUANTITY_AXIS_MISMATCH | RESOURCE_ID_MISMATCH | SENSOR_NOT_ASSOCIATED' })
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
  @ApiResponse({ status: 400, description: 'INVALID_SAMPLES_QUERY' })
  @ApiResponse({ status: 404, description: 'TIME_SERIES_NOT_FOUND' })
  getSamples(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<TimeSeriesSamplePage> {
    return this.telemetry.getSamplesPage(id, parseSamplesQuery(query));
  }

  @Get('time-series/:id/metrics')
  @ApiTags('time-series')
  @ApiOperation({ summary: 'count, mínimo, máximo, média, último valor e janela' })
  @ApiResponse({ status: 404, description: 'TIME_SERIES_NOT_FOUND' })
  getMetrics(@Param('id') id: string): Promise<SeriesMetrics> {
    return this.telemetry.getMetrics(id);
  }

  /** TS-05: remove a série e, em cascata, todas as suas amostras. */
  @Delete('time-series/:id')
  @ApiTags('time-series')
  @ApiOperation({ summary: 'Exclui a série e todas as suas amostras (cascata)' })
  @ApiResponse({ status: 204, description: 'Removida' })
  @ApiResponse({ status: 404, description: 'TIME_SERIES_NOT_FOUND' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTimeSeries(@Param('id') id: string): Promise<void> {
    return this.telemetry.removeTimeSeries(id);
  }
}
