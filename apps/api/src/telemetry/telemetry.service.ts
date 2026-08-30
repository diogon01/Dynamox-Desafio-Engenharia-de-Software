import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type Axis as PrismaAxis, type PhysicalQuantity as PrismaPhysicalQuantity } from '@prisma/client';

import {
  computePayloadFingerprint,
  isCanonicalMillisecondTimestamp,
  isValidIdempotencyKey,
  validateTelemetryCycle,
  type TelemetryCyclePayload,
} from '@dynamox/contracts';
import {
  EMPTY_SERIES_METRICS,
  QuantityAxisMismatchError,
  assertAxisValidForQuantity,
  type SeriesMetrics,
  type TimeSeriesSamplePage,
  type TimeSeriesSummary,
} from '@dynamox/domain';

import { PrismaService } from '../prisma/prisma.service';
import { toDomainMachineType } from '../common/machine-type.mapper';
import {
  toDomainAxis,
  toDomainPhysicalQuantity,
  toDomainSensorModel,
  toPrismaAxis,
  toPrismaPhysicalQuantity,
} from './telemetry.mappers';

export interface IngestionResult {
  duplicate: boolean;
  cycleId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  measurementCount: number;
  sampleCount: number;
  timeSeriesIds: string[];
}

const ORIGIN_TO_PRISMA = {
  simulation: 'SIMULATION',
  'rosbag-replay': 'ROSBAG_REPLAY',
  seed: 'SEED',
  manual: 'MANUAL',
} as const;

interface SeriesGroup {
  physicalQuantity: PrismaPhysicalQuantity;
  axis: PrismaAxis;
  unit: string;
  displayName?: Record<string, string>;
  points: Map<string, number>;
}

type CycleRecord = {
  id: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  measurementCount: number;
  sampleCount: number;
  timeSeriesIds: string[];
};

function conflictTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) {
    return target.map(String);
  }
  return typeof target === 'string' ? [target] : [];
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingestCycle(rawPayload: unknown, headerKey?: string): Promise<IngestionResult> {
    const validation = validateTelemetryCycle(rawPayload);
    if (!validation.valid) {
      throw new BadRequestException({
        code: 'CONTRACT_VIOLATION',
        message: 'Payload não conforme ao contrato interno de telemetria (SCP-04).',
        violations: validation.violations,
      });
    }

    const payload = validation.payload;
    const requestedKey = headerKey?.trim();

    if (requestedKey !== undefined && requestedKey.length > 0 && !isValidIdempotencyKey(requestedKey)) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message:
          'Idempotency-Key deve ter de 1 a 128 caracteres, restritos a letras, dígitos e os símbolos . _ ~ : -',
      });
    }

    // Defesa em profundidade: o schema já impõe o formato canônico, mas gravar um
    // instante diferente do informado seria uma perda silenciosa de dados.
    this.assertCanonicalTimestamps(payload);

    const payloadFingerprint = computePayloadFingerprint(payload);
    const idempotencyKey =
      requestedKey && requestedKey.length > 0 ? requestedKey : payloadFingerprint;

    const sameContent = await this.prisma.ingestionCycle.findUnique({
      where: { payloadFingerprint },
    });

    if (sameContent) {
      // Conteúdo idêntico já ingerido, com esta chave ou com outra: repetição legítima.
      return this.duplicateOf(sameContent);
    }

    const sameKey = await this.prisma.ingestionCycle.findUnique({ where: { idempotencyKey } });
    if (sameKey) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          'Esta Idempotency-Key já foi usada para um conteúdo diferente. Use uma chave nova para um ciclo novo.',
        existingCycleId: sameKey.id,
      });
    }

    return this.persistCycle(payload, idempotencyKey, payloadFingerprint);
  }

  private assertCanonicalTimestamps(payload: TelemetryCyclePayload): void {
    for (const measurement of payload.telemetryCycleData.measurements) {
      for (const point of measurement.dataPoints) {
        if (!isCanonicalMillisecondTimestamp(point.timestamp)) {
          throw new BadRequestException({
            code: 'NON_CANONICAL_TIMESTAMP',
            message: `O instante "${point.timestamp}" não está em UTC canônico com milissegundos exatos (YYYY-MM-DDTHH:mm:ss.SSSZ).`,
          });
        }
      }
    }
  }

  /**
   * Agrupa as medições pela identidade da série (grandeza + eixo). Duas medições do mesmo
   * ciclo podem apontar para a mesma série, então a detecção de instantes repetidos só é
   * confiável depois do agrupamento.
   */
  private groupMeasurements(payload: TelemetryCyclePayload): Map<string, SeriesGroup> {
    const groups = new Map<string, SeriesGroup>();

    for (const measurement of payload.telemetryCycleData.measurements) {
      const { physicalQuantity, axis, unit, displayName } = measurement.attributes;

      try {
        assertAxisValidForQuantity(physicalQuantity, axis);
      } catch (error) {
        if (error instanceof QuantityAxisMismatchError) {
          throw new UnprocessableEntityException({
            code: 'QUANTITY_AXIS_MISMATCH',
            message: error.message,
          });
        }
        throw error;
      }

      const prismaQuantity = toPrismaPhysicalQuantity(physicalQuantity);
      const prismaAxis = toPrismaAxis(axis);
      const groupKey = `${prismaQuantity}/${prismaAxis}`;

      let group = groups.get(groupKey);
      if (!group) {
        group = {
          physicalQuantity: prismaQuantity,
          axis: prismaAxis,
          unit,
          displayName: displayName as Record<string, string> | undefined,
          points: new Map<string, number>(),
        };
        groups.set(groupKey, group);
      }

      if (group.unit !== unit) {
        throw new ConflictException({
          code: 'SERIES_UNIT_CONFLICT',
          message: `O ciclo declara as unidades "${group.unit}" e "${unit}" para a mesma série (${physicalQuantity}${axis ? `/${axis}` : ''}).`,
        });
      }

      for (const point of measurement.dataPoints) {
        if (group.points.has(point.timestamp)) {
          throw new ConflictException({
            code: 'SAMPLE_TIMESTAMP_CONFLICT',
            message: `O próprio payload repete o instante ${point.timestamp} na série ${physicalQuantity}${axis ? `/${axis}` : ''}.`,
            timestamp: point.timestamp,
          });
        }
        group.points.set(point.timestamp, point.value);
      }
    }

    return groups;
  }

  private async persistCycle(
    payload: TelemetryCyclePayload,
    idempotencyKey: string,
    payloadFingerprint: string,
  ): Promise<IngestionResult> {
    const { telemetryCycleData, configuration } = payload;
    const serialNumber = telemetryCycleData.measuringSystemUniqueIdentifier;
    const groups = this.groupMeasurements(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Sensor e ponto monitorado são lidos dentro da transação: validá-los fora
        // deixaria uma janela para exclusão ou desassociação concorrente.
        const sensor = await tx.sensor.findUnique({
          where: { serialNumber },
          include: { monitoringPoint: true },
        });

        if (!sensor) {
          throw new NotFoundException({
            code: 'SENSOR_NOT_FOUND',
            message: `Nenhum sensor cadastrado com o identificador "${serialNumber}".`,
          });
        }

        if (!sensor.monitoringPoint) {
          throw new UnprocessableEntityException({
            code: 'SENSOR_NOT_ASSOCIATED',
            message: `O sensor "${serialNumber}" não está associado a um ponto de monitoramento.`,
          });
        }

        const expectedResourceId = sensor.monitoringPoint.externalResourceId;
        const unexpected = [
          ...new Set(
            telemetryCycleData.measurements
              .map((measurement) => measurement.resourceId)
              .filter((resourceId) => resourceId !== expectedResourceId),
          ),
        ];

        if (unexpected.length > 0) {
          throw new UnprocessableEntityException({
            code: 'RESOURCE_ID_MISMATCH',
            message: `resourceId(s) ${unexpected.join(', ')} não correspondem ao ponto monitorado do sensor "${serialNumber}" (esperado ${expectedResourceId}).`,
          });
        }

        const cycle = await tx.ingestionCycle.create({
          data: {
            idempotencyKey,
            payloadFingerprint,
            cycleId: telemetryCycleData.metadata.cycleId ?? null,
            measuringSystemUid: serialNumber,
            modelName: telemetryCycleData.measuringSystemModel.name,
            modelVersion: telemetryCycleData.measuringSystemModel.version,
            origin: ORIGIN_TO_PRISMA[telemetryCycleData.metadata.origin],
            tags: telemetryCycleData.tags,
            metadata: telemetryCycleData.metadata as unknown as Prisma.InputJsonValue,
            configuration: configuration as unknown as Prisma.InputJsonValue,
            measurementCount: telemetryCycleData.measurements.length,
          },
        });

        const timeSeriesIds: string[] = [];
        let sampleCount = 0;

        for (const group of groups.values()) {
          const existing = await tx.timeSeries.findUnique({
            where: {
              sensorId_physicalQuantity_axis: {
                sensorId: sensor.id,
                physicalQuantity: group.physicalQuantity,
                axis: group.axis,
              },
            },
          });

          let seriesId: string;

          if (existing) {
            // Reetiquetar a unidade mudaria o significado de todas as amostras já
            // gravadas, sem conversão. A série é imutável nesse aspecto.
            if (existing.unit !== group.unit) {
              throw new ConflictException({
                code: 'SERIES_UNIT_CONFLICT',
                message: `A série já está registrada em "${existing.unit}" e o ciclo declara "${group.unit}". Converta os valores ou use outra série.`,
                timeSeriesId: existing.id,
              });
            }
            seriesId = existing.id;
          } else {
            const created = await tx.timeSeries.create({
              data: {
                sensorId: sensor.id,
                physicalQuantity: group.physicalQuantity,
                axis: group.axis,
                unit: group.unit,
                displayName: (group.displayName as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
              },
            });
            seriesId = created.id;
          }

          const timestamps = [...group.points.keys()].map((value) => new Date(value));

          const collisions = await tx.timeSeriesSample.findMany({
            where: { timeSeriesId: seriesId, timestamp: { in: timestamps } },
            select: { timestamp: true },
            take: 5,
          });

          if (collisions.length > 0) {
            throw new ConflictException({
              code: 'SAMPLE_TIMESTAMP_CONFLICT',
              message: `A série já possui amostras nos instantes informados; um ciclo diferente não pode sobrescrever histórico.`,
              timeSeriesId: seriesId,
              conflictingTimestamps: collisions.map((row) => row.timestamp.toISOString()),
            });
          }

          // Sem skipDuplicates: uma colisão precisa abortar a transação inteira,
          // e não desaparecer como amostra silenciosamente descartada.
          const inserted = await tx.timeSeriesSample.createMany({
            data: [...group.points.entries()].map(([timestamp, value]) => ({
              timeSeriesId: seriesId,
              timestamp: new Date(timestamp),
              value,
              ingestionCycleId: cycle.id,
            })),
          });

          sampleCount += inserted.count;
          timeSeriesIds.push(seriesId);
        }

        const persisted = await tx.ingestionCycle.update({
          where: { id: cycle.id },
          data: { sampleCount, timeSeriesIds },
        });

        this.logger.log(
          `Ciclo ${cycle.id} persistido (fingerprint ${payloadFingerprint.slice(0, 12)}…): ` +
            `${persisted.measurementCount} medições, ${sampleCount} amostras.`,
        );

        return {
          duplicate: false,
          cycleId: cycle.id,
          idempotencyKey,
          payloadFingerprint,
          measurementCount: persisted.measurementCount,
          sampleCount,
          timeSeriesIds,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.resolveUniqueViolation(error, idempotencyKey, payloadFingerprint);
      }
      throw error;
    }
  }

  /**
   * Duas requisições idênticas simultâneas chegam aqui: a perdedora encontra o ciclo já
   * gravado e devolve exatamente o mesmo resultado da vencedora. Uma violação de unicidade
   * em outra coluna não pode ser confundida com duplicata.
   */
  private async resolveUniqueViolation(
    error: Prisma.PrismaClientKnownRequestError,
    idempotencyKey: string,
    payloadFingerprint: string,
  ): Promise<IngestionResult> {
    const targets = conflictTargets(error);
    const hitsCycleIdentity = targets.some((target) =>
      /payloadFingerprint|idempotencyKey/i.test(target),
    );

    if (hitsCycleIdentity) {
      const sameContent = await this.prisma.ingestionCycle.findUnique({
        where: { payloadFingerprint },
      });

      if (sameContent) {
        return this.duplicateOf(sameContent);
      }

      const sameKey = await this.prisma.ingestionCycle.findUnique({ where: { idempotencyKey } });
      if (sameKey) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message:
            'Esta Idempotency-Key já foi usada para um conteúdo diferente. Use uma chave nova para um ciclo novo.',
          existingCycleId: sameKey.id,
        });
      }
    }

    if (targets.some((target) => /timestamp|timeSeriesId/i.test(target))) {
      throw new ConflictException({
        code: 'SAMPLE_TIMESTAMP_CONFLICT',
        message: 'Uma amostra concorrente já ocupou um dos instantes deste ciclo.',
      });
    }

    throw error;
  }

  private duplicateOf(cycle: CycleRecord): IngestionResult {
    this.logger.log(
      `Ciclo já ingerido (fingerprint ${cycle.payloadFingerprint.slice(0, 12)}…): nada a persistir.`,
    );

    return {
      duplicate: true,
      cycleId: cycle.id,
      idempotencyKey: cycle.idempotencyKey,
      payloadFingerprint: cycle.payloadFingerprint,
      measurementCount: cycle.measurementCount,
      sampleCount: cycle.sampleCount,
      timeSeriesIds: cycle.timeSeriesIds,
    };
  }

  async listTimeSeries(): Promise<TimeSeriesSummary[]> {
    const series = await this.prisma.timeSeries.findMany({
      include: {
        sensor: { include: { monitoringPoint: { include: { machine: true } } } },
        _count: { select: { samples: true } },
        // Última amostra junto do resumo: sem isso, um painel de frota precisa de uma
        // chamada de métricas POR SÉRIE só para saber o valor e o instante mais recentes.
        samples: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { timestamp: true, value: true },
        },
      },
      orderBy: [{ physicalQuantity: 'asc' }, { axis: 'asc' }],
    });

    return series.map((item) => {
      const machine = item.sensor.monitoringPoint?.machine ?? null;

      return {
        id: item.id,
        sensorSerialNumber: item.sensor.serialNumber,
        sensorModel: toDomainSensorModel(item.sensor.model),
        machineName: machine?.name ?? null,
        machineType: machine ? toDomainMachineType(machine.type) : null,
        monitoringPointName: item.sensor.monitoringPoint?.name ?? null,
        physicalQuantity: toDomainPhysicalQuantity(item.physicalQuantity),
        axis: toDomainAxis(item.axis),
        unit: item.unit,
        displayName: (item.displayName as Record<string, string> | null) ?? null,
        sampleCount: item._count.samples,
        lastValue: item.samples[0]?.value ?? null,
        lastTimestamp: item.samples[0]?.timestamp.toISOString() ?? null,
      };
    });
  }

  /**
   * TS-03: recuperação completa por paginação offset/limit com `total` — o cliente
   * sempre sabe quantas amostras existem e consegue varrer a série inteira; nada é
   * truncado em silêncio. Página e contagem saem do MESMO snapshot (Repeatable Read).
   */
  async getSamplesPage(
    timeSeriesId: string,
    options: { limit: number; offset: number },
  ): Promise<TimeSeriesSamplePage> {
    await this.assertTimeSeriesExists(timeSeriesId);

    const [samples, total] = await this.prisma.$transaction(
      [
        this.prisma.timeSeriesSample.findMany({
          where: { timeSeriesId },
          orderBy: { timestamp: 'asc' },
          skip: options.offset,
          take: options.limit,
          select: { timestamp: true, value: true },
        }),
        this.prisma.timeSeriesSample.count({ where: { timeSeriesId } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return {
      items: samples.map((sample) => ({
        timestamp: sample.timestamp.toISOString(),
        value: sample.value,
      })),
      total,
      limit: options.limit,
      offset: options.offset,
    };
  }

  /**
   * TS-05: excluir a série remove as amostras em cascata (política do schema). O
   * registro de auditoria em IngestionCycle é preservado de propósito: ele documenta
   * que a ingestão aconteceu, mesmo que a série tenha sido apagada depois.
   */
  async removeTimeSeries(timeSeriesId: string): Promise<void> {
    try {
      await this.prisma.timeSeries.delete({ where: { id: timeSeriesId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException({
          code: 'TIME_SERIES_NOT_FOUND',
          message: `Série temporal "${timeSeriesId}" não encontrada.`,
        });
      }
      throw error;
    }
  }

  async getMetrics(timeSeriesId: string): Promise<SeriesMetrics> {
    await this.assertTimeSeriesExists(timeSeriesId);

    const aggregate = await this.prisma.timeSeriesSample.aggregate({
      where: { timeSeriesId },
      _count: { _all: true },
      _min: { value: true, timestamp: true },
      _max: { value: true, timestamp: true },
      _avg: { value: true },
    });

    if (aggregate._count._all === 0) {
      return EMPTY_SERIES_METRICS;
    }

    const last = await this.prisma.timeSeriesSample.findFirst({
      where: { timeSeriesId },
      orderBy: { timestamp: 'desc' },
      select: { value: true },
    });

    return {
      count: aggregate._count._all,
      min: aggregate._min.value,
      max: aggregate._max.value,
      avg: aggregate._avg.value,
      last: last?.value ?? null,
      firstTimestamp: aggregate._min.timestamp?.toISOString() ?? null,
      lastTimestamp: aggregate._max.timestamp?.toISOString() ?? null,
    };
  }

  private async assertTimeSeriesExists(timeSeriesId: string): Promise<void> {
    const exists = await this.prisma.timeSeries.findUnique({
      where: { id: timeSeriesId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException({
        code: 'TIME_SERIES_NOT_FOUND',
        message: `Série temporal "${timeSeriesId}" não encontrada.`,
      });
    }
  }
}
