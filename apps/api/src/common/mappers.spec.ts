/**
 * Unitários dos mapeadores de vocabulário: a tradução público ↔ interno precisa ser uma
 * bijeção total, senão um enum do banco vazaria para a API (ou vice-versa).
 */
import { MachineType, SensorModel } from '@prisma/client';

import { MACHINE_TYPES, SENSOR_MODELS } from '@dynamox/domain';

import { toDomainMachineType, toPrismaMachineType } from './machine-type.mapper';
import { toDomainSensorModel, toPrismaSensorModel } from './sensor-model.mapper';

describe('mapeadores de vocabulário público ↔ enum do banco', () => {
  it('tipo de máquina: ida e volta cobrem todos os valores dos dois lados', () => {
    for (const publicType of MACHINE_TYPES) {
      expect(toDomainMachineType(toPrismaMachineType(publicType))).toBe(publicType);
    }
    for (const prismaType of Object.values(MachineType)) {
      expect(toPrismaMachineType(toDomainMachineType(prismaType))).toBe(prismaType);
    }
  });

  it('modelo de sensor: ida e volta cobrem todos os valores, incluindo HF+ ↔ HF_PLUS', () => {
    for (const publicModel of SENSOR_MODELS) {
      expect(toDomainSensorModel(toPrismaSensorModel(publicModel))).toBe(publicModel);
    }
    for (const prismaModel of Object.values(SensorModel)) {
      expect(toPrismaSensorModel(toDomainSensorModel(prismaModel))).toBe(prismaModel);
    }
    expect(toPrismaSensorModel('HF+')).toBe('HF_PLUS');
  });
});
