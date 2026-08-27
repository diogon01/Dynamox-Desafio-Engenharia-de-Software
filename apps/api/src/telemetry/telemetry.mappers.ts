import type { Axis as DomainAxis, PhysicalQuantity, SensorModel } from '@dynamox/domain';
import { Axis, PhysicalQuantity as PrismaPhysicalQuantity, SensorModel as PrismaSensorModel } from '@prisma/client';

const PHYSICAL_QUANTITY_TO_PRISMA: Record<PhysicalQuantity, PrismaPhysicalQuantity> = {
  acceleration: PrismaPhysicalQuantity.ACCELERATION,
  velocity: PrismaPhysicalQuantity.VELOCITY,
  temperature: PrismaPhysicalQuantity.TEMPERATURE,
  rotationalSpeed: PrismaPhysicalQuantity.ROTATIONAL_SPEED,
};

const PRISMA_TO_PHYSICAL_QUANTITY: Record<PrismaPhysicalQuantity, PhysicalQuantity> = {
  ACCELERATION: 'acceleration',
  VELOCITY: 'velocity',
  TEMPERATURE: 'temperature',
  ROTATIONAL_SPEED: 'rotationalSpeed',
};

const AXIS_TO_PRISMA: Record<DomainAxis, Axis> = {
  x: Axis.X,
  y: Axis.Y,
  z: Axis.Z,
};

const PRISMA_TO_SENSOR_MODEL: Record<PrismaSensorModel, SensorModel> = {
  TC_AG: 'TcAg',
  TC_AS: 'TcAs',
  HF_PLUS: 'HF+',
};

export function toPrismaPhysicalQuantity(value: PhysicalQuantity): PrismaPhysicalQuantity {
  return PHYSICAL_QUANTITY_TO_PRISMA[value];
}

export function toDomainPhysicalQuantity(value: PrismaPhysicalQuantity): PhysicalQuantity {
  return PRISMA_TO_PHYSICAL_QUANTITY[value];
}

/** Grandezas não direcionais (temperatura) são persistidas como NONE, nunca NULL. */
export function toPrismaAxis(value: DomainAxis | undefined): Axis {
  return value ? AXIS_TO_PRISMA[value] : Axis.NONE;
}

export function toDomainAxis(value: Axis): DomainAxis | null {
  return value === Axis.NONE ? null : (value.toLowerCase() as DomainAxis);
}

export function toDomainSensorModel(value: PrismaSensorModel): SensorModel {
  return PRISMA_TO_SENSOR_MODEL[value];
}
