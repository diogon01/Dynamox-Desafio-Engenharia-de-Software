/**
 * Qualidade do contrato publicado em /api/docs-json.
 *
 * Existe para que a documentação não volte a ser uma frase descrevendo o formato: toda
 * resposta precisa apontar para um schema navegável. Uma rota nova sem schema quebra
 * este teste em vez de chegar silenciosamente ao avaliador.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

/** 204 não tem corpo por definição; qualquer outro status precisa descrever o que devolve. */
const STATUSES_WITHOUT_BODY = new Set(['204']);

describe('contrato OpenAPI publicado', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    document = buildOpenApiDocument(app);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  const operations = (): Array<{ path: string; method: string; operation: Record<string, unknown> }> =>
    Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, unknown>)
        .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
        .map(([method, operation]) => ({
          path,
          method,
          operation: operation as Record<string, unknown>,
        })),
    );

  it('publica schemas reutilizáveis em components.schemas', () => {
    const schemas = document.components?.schemas ?? {};
    expect(Object.keys(schemas).length).toBeGreaterThan(0);
    // Os modelos centrais precisam existir para que as rotas possam referenciá-los.
    for (const name of ['ErrorResponse', 'MachineResponse', 'MonitoringPointPageResponse']) {
      expect(schemas[name]).toBeDefined();
    }
  });

  it('toda resposta com corpo aponta para um schema', () => {
    const semSchema: string[] = [];
    for (const { path, method, operation } of operations()) {
      const responses = (operation.responses ?? {}) as Record<string, { content?: unknown }>;
      for (const [status, response] of Object.entries(responses)) {
        if (STATUSES_WITHOUT_BODY.has(status)) continue;
        if (!response.content) semSchema.push(`${method.toUpperCase()} ${path} → ${status}`);
      }
    }
    expect(semSchema).toEqual([]);
  });

  it('toda rota declara pelo menos um status de erro', () => {
    for (const { operation } of operations()) {
      const codes = Object.keys((operation.responses ?? {}) as Record<string, unknown>);
      expect(codes.some((code) => code.startsWith('4') || code.startsWith('5'))).toBe(true);
    }
  });

  it('nenhum parâmetro é declarado duas vezes na mesma rota', () => {
    for (const { operation } of operations()) {
      const params = (operation.parameters ?? []) as Array<{ name: string; in: string }>;
      const keys = params.map((p) => `${p.in}:${p.name.toLowerCase()}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('só parâmetros de rota são obrigatórios — query e header opcionais não mentem', () => {
    for (const { path, method, operation } of operations()) {
      const params = (operation.parameters ?? []) as Array<{ name: string; in: string; required?: boolean }>;
      for (const param of params) {
        if (param.in !== 'path' && param.required) {
          throw new Error(`${method.toUpperCase()} ${path}: ${param.in} "${param.name}" está como obrigatório`);
        }
      }
    }
  });

  it('operações de corpo trazem exemplo utilizável', () => {
    const semExemplo: string[] = [];
    for (const { path, method, operation } of operations()) {
      const body = operation.requestBody as
        | { content?: Record<string, { schema?: unknown; examples?: unknown; example?: unknown }> }
        | undefined;
      if (!body?.content) continue;
      const media = Object.values(body.content)[0];
      const temExemplo = Boolean(media?.examples ?? media?.example);
      if (!temExemplo) semExemplo.push(`${method.toUpperCase()} ${path}`);
    }
    expect(semExemplo).toEqual([]);
  });

  it('cada operação tem resumo legível e pertence a uma seção', () => {
    for (const { operation } of operations()) {
      expect(typeof operation.summary).toBe('string');
      expect((operation.summary as string).length).toBeGreaterThan(10);
      expect((operation.tags as string[]).length).toBeGreaterThan(0);
    }
  });
});
