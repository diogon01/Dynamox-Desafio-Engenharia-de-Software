import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import type { SeriesMetrics, TimeSeriesSampleDto, TimeSeriesSummary } from '@dynamox/domain';

import { TelemetryService, type IngestionResult } from './telemetry.service';

@Controller()
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  /**
   * TS-06. A chave de idempotência chega pelo header porque telemetryCycleData declara
   * additionalProperties:false — nenhum campo novo pode ser acrescentado ao payload.
   * Quando o header não vem, a chave é derivada do próprio conteúdo do ciclo.
   */
  @Post('telemetry-cycles')
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
  listTimeSeries(): Promise<TimeSeriesSummary[]> {
    return this.telemetry.listTimeSeries();
  }

  @Get('time-series/:id/samples')
  getSamples(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ): Promise<TimeSeriesSampleDto[]> {
    const parsed = Number(limit);
    return this.telemetry.getSamples(id, Number.isFinite(parsed) && parsed > 0 ? parsed : 500);
  }

  @Get('time-series/:id/metrics')
  getMetrics(@Param('id') id: string): Promise<SeriesMetrics> {
    return this.telemetry.getMetrics(id);
  }
}
