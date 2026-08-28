import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import {
  parseAssignSensorDto,
  parseCreateMonitoringPointDto,
  parseListMonitoringPointsQuery,
} from './monitoring-points.dto';
import {
  MonitoringPointsService,
  type MonitoringPointDto,
  type MonitoringPointPageDto,
} from './monitoring-points.service';

/**
 * Todas as rotas são privadas: sem @Public(), o guard JWT global do AUT-01 já exige
 * `Authorization: Bearer <token>` em cada uma delas.
 */
@Controller('monitoring-points')
export class MonitoringPointsController {
  constructor(private readonly monitoringPoints: MonitoringPointsService) {}

  @Post()
  create(@Body() body: unknown): Promise<MonitoringPointDto> {
    return this.monitoringPoints.create(parseCreateMonitoringPointDto(body));
  }

  @Get()
  list(@Query() query: Record<string, unknown>): Promise<MonitoringPointPageDto> {
    return this.monitoringPoints.list(parseListMonitoringPointsQuery(query));
  }

  @Post(':id/sensor')
  assignSensor(@Param('id') id: string, @Body() body: unknown): Promise<MonitoringPointDto> {
    return this.monitoringPoints.assignSensor(id, parseAssignSensorDto(body));
  }
}
