import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Documentação viva da API em /api/docs (UI) e /api/docs-json (OpenAPI 3).
 * O contrato rígido real é aplicado pelos parsers dos DTOs (chaves desconhecidas são
 * 400 em corpo e query); o Swagger descreve esse comportamento, não o substitui.
 */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Dynamox Challenge API')
    .setDescription(
      'API do desafio Full-Stack: autenticação JWT, CRUD de máquinas, pontos de ' +
        'monitoramento e sensores (regra Pump × TcAg/TcAs), ingestão idempotente de ' +
        'telemetria e leitura/exclusão de séries temporais. Corpos e query strings ' +
        'rejeitam propriedades desconhecidas com 400. Todas as rotas, exceto ' +
        '/api/health e /api/auth/login, exigem Authorization: Bearer <token>.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag('health', 'Probe de disponibilidade (público)')
    .addTag('auth', 'Login com credencial fixa e sessão JWT')
    .addTag('machines', 'CRUD de máquinas (Pump/Fan)')
    .addTag('monitoring-points', 'Pontos de monitoramento e sensores')
    .addTag('telemetry', 'Ingestão idempotente de ciclos (contrato SCP-04)')
    .addTag('time-series', 'Leitura paginada, métricas e exclusão de séries')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Dynamox Challenge API',
    swaggerOptions: { persistAuthorization: true },
  });
}
