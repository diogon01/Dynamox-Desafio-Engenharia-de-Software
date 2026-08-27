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

import { parseCreateMachineDto, parseUpdateMachineDto } from './machines.dto';
import { MachinesService, type MachineDto } from './machines.service';

/**
 * Todas as rotas são privadas: sem @Public(), o guard JWT global do AUT-01 já exige
 * `Authorization: Bearer <token>` em cada uma delas.
 */
@Controller('machines')
export class MachinesController {
  constructor(private readonly machines: MachinesService) {}

  @Post()
  create(@Body() body: unknown): Promise<MachineDto> {
    return this.machines.create(parseCreateMachineDto(body));
  }

  @Get()
  list(): Promise<MachineDto[]> {
    return this.machines.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<MachineDto> {
    return this.machines.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown): Promise<MachineDto> {
    return this.machines.update(id, parseUpdateMachineDto(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.machines.remove(id);
  }
}
