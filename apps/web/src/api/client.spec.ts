import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, assertLocalApiBaseUrl, setToken } from './client';

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

describe('api.machines / api.createMachine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setToken(null);
  });

  it('1. GET /machines envia o Bearer', async () => {
    setToken('jwt-abc');
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.machines();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/machines$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
  });

  it('2. POST /machines envia Bearer e o JSON correto', async () => {
    setToken('jwt-abc');
    const created = {
      id: '1',
      name: 'P-102',
      type: 'Pump',
      createdAt: 'x',
      updatedAt: 'x',
    };
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(created), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.createMachine('P-102', 'Pump');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/machines$/);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'P-102', type: 'Pump' });
    expect(result).toEqual(created);
  });

  it('3. erro 409 preserva a mensagem devolvida pela API', async () => {
    setToken('jwt-abc');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'MACHINE_NAME_CONFLICT',
              message: 'Já existe uma máquina com o nome "P-101".',
            }),
            { status: 409 },
          ),
      ),
    );

    await expect(api.createMachine('P-101', 'Fan')).rejects.toThrow(
      'Já existe uma máquina com o nome "P-101".',
    );
  });
});
