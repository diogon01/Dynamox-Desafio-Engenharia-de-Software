/**
 * Seed determinístico e mínimo: exatamente o suficiente para demonstrar a cadeia
 * máquina -> ponto de monitoramento -> sensor -> série temporal, com dados sintéticos.
 * Rodar duas vezes não duplica nada (tudo é upsert por chave natural).
 */
import { randomBytes, scryptSync } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { deterministicResourceId } from '@dynamox/contracts';

const prisma = new PrismaClient();

const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL ?? 'analista@dynamox.local';
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Dynamox@2026';

const MACHINE_NAME = 'P-101';
const MONITORING_POINT_NAME = 'Mancal lado acoplamento';
const SENSOR_SERIAL = 'SIM-HF-001';

/**
 * Amostras da demonstração: 30 pontos a cada 10 s, terminando em um instante fixo.
 * A janela começa às 12:10 UTC de propósito, depois do exemplo de ingestão em
 * contracts/dynamox/examples (12:00:00–12:00:20): sobreposição entre seed e exemplo
 * faria a ingestão legítima do exemplo ser recusada por conflito de instante.
 */
const SAMPLE_COUNT = 30;
const SAMPLE_INTERVAL_MS = 10_000;
const SERIES_END = Date.UTC(2026, 7, 26, 12, 15, 0);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Gerador pseudoaleatório próprio (LCG) em vez de Math.random: a mesma seed precisa
 * produzir exatamente a mesma série em qualquer máquina, para que a evidência do
 * desafio seja reproduzível.
 */
function createDeterministicNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: { name: 'Analista de Manutenção' },
    create: {
      email: SEED_USER_EMAIL,
      name: 'Analista de Manutenção',
      passwordHash: hashPassword(SEED_USER_PASSWORD),
    },
  });

  const machine = await prisma.machine.upsert({
    where: { name: MACHINE_NAME },
    update: { type: 'PUMP' },
    create: { name: MACHINE_NAME, type: 'PUMP' },
  });

  const externalResourceId = deterministicResourceId(
    'dynamox-challenge',
    'monitoring-point',
    MACHINE_NAME,
    MONITORING_POINT_NAME,
  );

  const monitoringPoint = await prisma.monitoringPoint.upsert({
    where: { machineId_name: { machineId: machine.id, name: MONITORING_POINT_NAME } },
    update: { externalResourceId },
    create: {
      name: MONITORING_POINT_NAME,
      machineId: machine.id,
      externalResourceId,
    },
  });

  // HF+ é o único modelo compatível com uma máquina Pump (TcAg e TcAs são proibidos
  // pelo enunciado). A regra é aplicada em @dynamox/domain e validada nos testes.
  const sensor = await prisma.sensor.upsert({
    where: { serialNumber: SENSOR_SERIAL },
    update: { model: 'HF_PLUS', monitoringPointId: monitoringPoint.id },
    create: {
      serialNumber: SENSOR_SERIAL,
      model: 'HF_PLUS',
      monitoringPointId: monitoringPoint.id,
    },
  });

  const timeSeries = await prisma.timeSeries.upsert({
    where: {
      sensorId_physicalQuantity_axis: {
        sensorId: sensor.id,
        physicalQuantity: 'ACCELERATION',
        axis: 'Y',
      },
    },
    update: { unit: 'g' },
    create: {
      sensorId: sensor.id,
      physicalQuantity: 'ACCELERATION',
      axis: 'Y',
      unit: 'g',
      displayName: {
        pt: 'Aceleração RMS — eixo Y',
        en: 'Acceleration RMS — Y axis',
      },
    },
  });

  const noise = createDeterministicNoise(20_260_826);
  const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const timestamp = new Date(SERIES_END - (SAMPLE_COUNT - 1 - index) * SAMPLE_INTERVAL_MS);
    const trend = 0.02 + 0.0004 * index;
    const value = Number((trend + 0.004 * noise()).toFixed(6));
    return { timeSeriesId: timeSeries.id, timestamp, value };
  });

  await prisma.timeSeriesSample.createMany({ data: samples, skipDuplicates: true });

  const sampleCount = await prisma.timeSeriesSample.count({
    where: { timeSeriesId: timeSeries.id },
  });

  console.log('Seed concluído (dados sintéticos de demonstração):');
  console.log(`  usuário............: ${user.email}`);
  console.log(`  máquina............: ${machine.name} (${machine.type})`);
  console.log(`  ponto de monitor...: ${monitoringPoint.name}`);
  console.log(`  resourceId.........: ${monitoringPoint.externalResourceId}`);
  console.log(`  sensor.............: ${sensor.serialNumber} (${sensor.model})`);
  console.log(`  série temporal.....: ${timeSeries.id} — ${sampleCount} amostras`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Falha no seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
