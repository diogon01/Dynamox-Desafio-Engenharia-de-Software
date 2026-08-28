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

/**
 * O enunciado pede pelo menos dois pontos de monitoramento. Ambos ficam na P-101
 * (mancais dos dois lados do eixo), cada um com seu sensor HF+ — único modelo
 * permitido em uma Pump.
 */
const MONITORING_POINTS = [
  { name: 'Mancal lado acoplamento', sensorSerial: 'SIM-HF-001' },
  { name: 'Mancal lado oposto ao acoplamento', sensorSerial: 'SIM-HF-002' },
] as const;

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
  // O update também redefine o passwordHash: a credencial fixa anunciada precisa valer
  // mesmo que o registro já exista com outra senha.
  const user = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: { name: 'Analista de Manutenção', passwordHash: hashPassword(SEED_USER_PASSWORD) },
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

  const points = [];
  for (const { name, sensorSerial } of MONITORING_POINTS) {
    // Derivação INTENCIONALMENTE pelo NOME da máquina (e não pelo id, como faz a API):
    // o id é um UUID gerado pelo banco e mudaria a cada ambiente, destruindo o
    // determinismo do seed e quebrando o resourceId 42d726ba... referenciado pelo
    // exemplo de ingestão em contracts/dynamox/examples.
    const externalResourceId = deterministicResourceId(
      'dynamox-challenge',
      'monitoring-point',
      MACHINE_NAME,
      name,
    );

    const monitoringPoint = await prisma.monitoringPoint.upsert({
      where: { machineId_name: { machineId: machine.id, name } },
      update: { externalResourceId },
      create: { name, machineId: machine.id, externalResourceId },
    });

    // HF+ é o único modelo compatível com uma máquina Pump (TcAg e TcAs são proibidos
    // pelo enunciado). A regra é aplicada em @dynamox/domain e validada nos testes.
    const sensor = await prisma.sensor.upsert({
      where: { serialNumber: sensorSerial },
      update: { model: 'HF_PLUS', monitoringPointId: monitoringPoint.id },
      create: {
        serialNumber: sensorSerial,
        model: 'HF_PLUS',
        monitoringPointId: monitoringPoint.id,
      },
    });

    points.push({ monitoringPoint, sensor });
  }

  // A série temporal de demonstração fica no sensor do primeiro ponto (lado acoplamento).
  const [{ sensor }] = points;

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
  for (const point of points) {
    console.log(
      `  ponto de monitor...: ${point.monitoringPoint.name} — sensor ` +
        `${point.sensor.serialNumber} (${point.sensor.model}) — ` +
        `resourceId ${point.monitoringPoint.externalResourceId}`,
    );
  }
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
