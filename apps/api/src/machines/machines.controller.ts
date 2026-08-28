import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { parseCreateMachineDto, parseUpdateMachineDto } from './machines.dto';
import { MachinesService, type MachineDto } from './machines.service';

/**
 * Todas as rotas são privadas: sem @Public(), o guard JWT global do AUT-01 já exige
 * `Authorization: Bearer <token>` em cada uma delas.
 */
@ApiTags('machines')
@ApiBearerAuth('bearer')
@ApiResponse({ status: 401, description: 'Token ausente, inválido ou expirado' })
@Controller('machines')
export class MachinesController {
  constructor(private readonly machines: MachinesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma máquina (name + type em Pump/Fan)' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', maxLength: 120, example: 'P-101' },
        type: { type: 'string', enum: ['Pump', 'Fan'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Máquina criada' })
  @ApiResponse({ status: 400, description: 'INVALID_MACHINE_PAYLOAD | INVALID_MACHINE_TYPE' })
  @ApiResponse({ status: 409, description: 'MACHINE_NAME_CONFLICT' })
  create(@Body() body: unknown): Promise<MachineDto> {
    return this.machines.create(parseCreateMachineDto(body));
  }

  @Get()
  @ApiOperation({ summary: 'Lista as máquinas ordenadas por nome' })
  list(): Promise<MachineDto[]> {
    return this.machines.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Uma máquina pelo id' })
  @ApiResponse({ status: 404, description: 'MACHINE_NOT_FOUND' })
  findOne(@Param('id') id: string): Promise<MachineDto> {
    return this.machines.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Altera name e/ou type; corpo vazio é 400' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', maxLength: 120, example: 'P-101' },
        type: { type: 'string', enum: ['Pump', 'Fan'] },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'MACHINE_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'MACHINE_NAME_CONFLICT | MACHINE_TYPE_SENSOR_CONFLICT (virar Pump com sensor TcAg/TcAs é revertido)',
  })
  update(@Param('id') id: string, @Body() body: unknown): Promise<MachineDto> {
    return this.machines.update(id, parseUpdateMachineDto(body));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a máquina; pontos de monitoramento caem em cascata' })
  @ApiResponse({ status: 204, description: 'Removida' })
  @ApiResponse({ status: 404, description: 'MACHINE_NOT_FOUND' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.machines.remove(id);
  }
}
