import { describe, expect, it } from 'vitest';

import { assertLocalApiBaseUrl } from './client';

describe('assertLocalApiBaseUrl', () => {
  it('aceita a API local do projeto', () => {
    expect(assertLocalApiBaseUrl('http://localhost:3000/api')).toBe('http://localhost:3000/api');
    expect(assertLocalApiBaseUrl('http://127.0.0.1:3000/api/')).toBe('http://127.0.0.1:3000/api');
  });

  it('recusa qualquer domínio da Dynamox', () => {
    expect(() => assertLocalApiBaseUrl('https://api.dynamox.solutions')).toThrow(/Dynamox/);
    expect(() => assertLocalApiBaseUrl('https://dynamox.net/v1')).toThrow(/Dynamox/);
  });

  it('recusa URL inválida', () => {
    expect(() => assertLocalApiBaseUrl('nao-e-uma-url')).toThrow(/inválida/);
  });
});
