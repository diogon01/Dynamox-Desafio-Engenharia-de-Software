/**
 * Fachada Nest do motor de alertas: garante as regras da política no boot, avalia cada
 * ciclo depois do commit da ingestão e expõe o motor às consultas.
 *
 * `ALERTS_EVALUATE_ON_INGEST=false` desliga a avaliação síncrona (útil para carregar um
 * histórico e reconciliá-lo depois com `alerts:backfill`).
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AlertEngine, type EvaluationSummary } from './alert-engine';
import { ensureAlertRules, type RuleRecord } from './alert-rules';

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  private engine: AlertEngine | null = null;
  private rules: RuleRecord[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ready();
  }

  get evaluateOnIngest(): boolean {
    return (process.env.ALERTS_EVALUATE_ON_INGEST ?? 'true').trim().toLowerCase() !== 'false';
  }

  /** Regras habilitadas da política ativa (garantidas no banco). */
  async loadRules(): Promise<RuleRecord[]> {
    await this.ready();
    return this.rules;
  }

  /** Chamado pela ingestão após o commit: nunca lança, nunca altera a resposta ao produtor. */
  async afterCycleIngested(cycleId: string): Promise<void> {
    if (!this.evaluateOnIngest) return;
    try {
      const summary = await this.evaluateCycle(cycleId);
      if (summary.outOfOrder > 0) {
        this.logger.warn(
          `Ciclo ${cycleId} é mais antigo que a marca d'água do ponto: avaliação registrada como OUT_OF_ORDER ` +
            `(${summary.outOfOrder} regra(s)); reconcilie com "npm run alerts:backfill".`,
        );
      }
      if (summary.opened + summary.escalated + summary.resolved + summary.resumed > 0) {
        this.logger.log(
          `Ciclo ${cycleId}: alertas abertos ${summary.opened}, escalados ${summary.escalated}, ` +
            `resolvidos ${summary.resolved + summary.resumed}.`,
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(`Falha ao avaliar alertas do ciclo ${cycleId}; a ingestão não foi afetada.`, detail);
    }
  }

  async evaluateCycle(cycleId: string): Promise<EvaluationSummary> {
    const engine = await this.ready();
    return engine.evaluateCycle(cycleId);
  }

  private async ready(): Promise<AlertEngine> {
    if (this.engine) return this.engine;
    this.rules = (await ensureAlertRules(this.prisma)).filter((rule) => rule.enabled);
    this.engine = new AlertEngine(this.prisma, this.rules);
    return this.engine;
  }
}
