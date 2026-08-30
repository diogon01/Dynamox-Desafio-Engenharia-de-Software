import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

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
@ApiTags('monitoring-points')
@ApiBearerAuth('bearer')
@ApiResponse({ status: 401, description: 'Token ausente, inválido ou expirado' })
@Controller('monitoring-points')
export class MonitoringPointsController {
  constructor(private readonly monitoringPoints: MonitoringPointsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um ponto de monitoramento para uma máquina' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        machineId: { type: 'string', format: 'uuid' },
        name: { type: 'string', maxLength: 120, example: 'Mancal lado acoplamento' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Ponto criado (sensor: null)' })
  @ApiResponse({ status: 400, description: 'INVALID_MONITORING_POINT_PAYLOAD' })
  @ApiResponse({ status: 404, description: 'MACHINE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'MONITORING_POINT_NAME_CONFLICT (nome único por máquina)' })
  create(@Body() body: unknown): Promise<MonitoringPointDto> {
    return this.monitoringPoints.create(parseCreateMonitoringPointDto(body));
  }

  @Get()
  @ApiOperation({
    summary: 'Lista paginada e ordenável (a interface usa sempre 5 por página)',
    description:
      'Ordena pelo vocabulário público exibido na tabela (ex.: HF+ < TcAg < TcAs), pontos sem sensor ao final. Parâmetros desconhecidos são 400.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 } })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    schema: { type: 'string', enum: ['machineName', 'machineType', 'pointName', 'sensorModel'], default: 'machineName' },
  })
  @ApiQuery({ name: 'sortDir', required: false, schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Busca por trecho, sem diferenciar maiúsculas, no nome da máquina, no nome do ponto e na série do sensor.',
    schema: { type: 'string', maxLength: 120 },
  })
  @ApiQuery({ name: 'machineType', required: false, schema: { type: 'string', enum: ['Pump', 'Fan'] } })
  @ApiQuery({ name: 'sensorModel', required: false, schema: { type: 'string', enum: ['TcAg', 'TcAs', 'HF+'] } })
  @ApiQuery({
    name: 'hasSensor',
    required: false,
    description: 'true devolve só pontos com sensor associado; false, só os sem sensor.',
    schema: { type: 'string', enum: ['true', 'false'] },
  })
  @ApiResponse({
    status: 200,
    description:
      '{ items, total, page, pageSize, totalPages, sortBy, sortDir, search, machineType, sensorModel, hasSensor }. ' +
      'A tela do desafio usa pageSize=5; total e totalPages já refletem o recorte de busca e filtros.',
  })
  @ApiResponse({ status: 400, description: 'INVALID_MONITORING_POINT_QUERY' })
  list(@Query() query: Record<string, unknown>): Promise<MonitoringPointPageDto> {
    return this.monitoringPoints.list(parseListMonitoringPointsQuery(query));
  }

  @Post(':id/sensor')
  @ApiOperation({ summary: 'Associa um sensor novo ao ponto (máx. 1 por ponto)' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        serialNumber: { type: 'string', maxLength: 60, example: 'SIM-HF-003' },
        model: { type: 'string', enum: ['TcAg', 'TcAs', 'HF+'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Sensor associado' })
  @ApiResponse({ status: 400, description: 'INVALID_MONITORING_POINT_PAYLOAD | INVALID_SENSOR_MODEL' })
  @ApiResponse({ status: 404, description: 'MONITORING_POINT_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description:
      'SENSOR_MODEL_NOT_ALLOWED (Pump × TcAg/TcAs) | SENSOR_SERIAL_CONFLICT | MONITORING_POINT_SENSOR_CONFLICT',
  })
  assignSensor(@Param('id') id: string, @Body() body: unknown): Promise<MonitoringPointDto> {
    return this.monitoringPoints.assignSensor(id, parseAssignSensorDto(body));
  }
}
