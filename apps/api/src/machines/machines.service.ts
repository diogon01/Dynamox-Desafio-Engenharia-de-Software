import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Machine as PrismaMachine } from '@prisma/client';

import type { MachineType } from '@dynamox/domain';

import { toDomainMachineType, toPrismaMachineType } from '../common/machine-type.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMachineDto, UpdateMachineDto } from './machines.dto';

export interface MachineDto {
  id: string;
  name: string;
  type: MachineType;
  createdAt: string;
  updatedAt: string;
}

/** A resposta usa sempre o vocabulário público (Pump/Fan), nunca o enum do Prisma. */
function toDto(machine: PrismaMachine): MachineDto {
  return {
    id: machine.id,
    name: machine.name,
    type: toDomainMachineType(machine.type),
    createdAt: machine.createdAt.toISOString(),
    updatedAt: machine.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

@Injectable()
export class MachinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMachineDto): Promise<MachineDto> {
    try {
      const machine = await this.prisma.machine.create({
        data: { name: dto.name, type: toPrismaMachineType(dto.type) },
      });
      return toDto(machine);
    } catch (error) {
      // A unicidade do nome é garantida pelo índice do PostgreSQL, e não por uma
      // consulta prévia: assim duas requisições concorrentes não criam duplicata.
      if (isUniqueViolation(error)) throw this.nameConflict(dto.name);
      throw error;
    }
  }

  /** Ordenação determinística por nome, para a listagem não variar entre chamadas. */
  async list(): Promise<MachineDto[]> {
    const machines = await this.prisma.machine.findMany({ orderBy: { name: 'asc' } });
    return machines.map(toDto);
  }

  async findOne(id: string): Promise<MachineDto> {
    const machine = await this.prisma.machine.findUnique({ where: { id } });
    if (!machine) throw this.notFound(id);
    return toDto(machine);
  }

  async update(id: string, dto: UpdateMachineDto): Promise<MachineDto> {
    try {
      const machine = await this.prisma.machine.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.type !== undefined ? { type: toPrismaMachineType(dto.type) } : {}),
        },
      });
      return toDto(machine);
    } catch (error) {
      if (isUniqueViolation(error)) throw this.nameConflict(dto.name ?? '');
      if (isRecordNotFound(error)) throw this.notFound(id);
      throw error;
    }
  }

  /**
   * Excluir a máquina remove em cascata seus pontos de monitoramento (política já
   * declarada no schema); os sensores são apenas desassociados, não apagados.
   */
  async remove(id: string): Promise<void> {
    try {
      await this.prisma.machine.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFound(error)) throw this.notFound(id);
      throw error;
    }
  }

  private nameConflict(name: string): ConflictException {
    return new ConflictException({
      code: 'MACHINE_NAME_CONFLICT',
      message: `Já existe uma máquina com o nome "${name}".`,
    });
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'MACHINE_NOT_FOUND',
      message: `Máquina "${id}" não encontrada.`,
    });
  }
}
