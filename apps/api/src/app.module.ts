import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MachinesModule } from './machines/machines.module';
import { MonitoringPointsModule } from './monitoring-points/monitoring-points.module';
import { PrismaModule } from './prisma/prisma.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    MachinesModule,
    MonitoringPointsModule,
    TelemetryModule,
  ],
})
export class AppModule {}
