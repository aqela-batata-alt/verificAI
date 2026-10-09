import { describe, expect, it, vi } from 'vitest'
import { apiErrors, apiInconclusive, makeApiAnalysis } from '../test/fixtures.js'
import { createAnalysesApi } from './analysesApi.js'
import { createHttpClient } from './http.js'

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })

function setup(respond) {
  const fetchImpl = vi.fn(async () => respond())
  const http = createHttpClient({ baseUrl: '/api', timeoutMs: 30_000, fetchImpl })
  const api = createAnalysesApi({ http, getVisitorId: () => 'visitante-anonimo-0001' })
  return { api, fetchImpl }
}

describe('POST /api/v1/analyses/ (RF24, RF29)', () => {
  it('modo texto: envia só input_type e text', async () => {
    const { api, fetchImpl } = setup(() => json(makeApiAnalysis(), { status: 201 }))
    const analysis = await api.create({ inputType: 'text', text: 'a'.repeat(60) })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/v1/analyses/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ input_type: 'text', text: 'a'.repeat(60) })
    expect(analysis.status.code).toBe('requer_atencao')
  })

  it('modo link: envia só input_type e url (nada do texto)', async () => {
    const { api, fetchImpl } = setup(() => json(makeApiAnalysis({ input_type: 'url' }), { status: 201 }))
    await api.create({ inputType: 'url', url: 'https://exemplo.com/noticia' })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ input_type: 'url', url: 'https://exemplo.com/noticia' })
  })

  it('manda o identificador anônimo no cabeçalho X-Visitor-Id', async () => {
    const { api, fetchImpl } = setup(() => json(makeApiAnalysis(), { status: 201 }))
    await api.create({ inputType: 'text', text: 'a'.repeat(60) })
    expect(fetchImpl.mock.calls[0][1].headers['X-Visitor-Id']).toBe('visitante-anonimo-0001')
  })

  it('devolve análise inconclusiva como resultado válido (não é erro)', async () => {
    const { api } = setup(() => json(apiInconclusive(), { status: 201 }))
    const analysis = await api.create({ inputType: 'text', text: 'a'.repeat(60) })
    expect(analysis.status.code).toBe('analise_inconclusiva')
    expect(analysis.riskIndex).toBeNull()
  })

  it('erro de validação do servidor vira AppError (RF29: estrutura de erro documentada)', async () => {
    const { api } = setup(() => json(apiErrors.unsupportedLanguage, { status: 400 }))
    await expect(api.create({ inputType: 'text', text: 'a'.repeat(60) })).rejects.toMatchObject({
      scenario: 'unsupported_language',
      field: 'text',
    })
  })

  it('entrada por link ainda indisponível (501) vira o cenário url_unavailable', async () => {
    const { api } = setup(() => json(apiErrors.urlUnavailable, { status: 501 }))
    await expect(api.create({ inputType: 'url', url: 'https://exemplo.com' })).rejects.toMatchObject({ scenario: 'url_unavailable' })
  })

  it('RF29: resposta de uma versão de API desconhecida é recusada', async () => {
    const { api } = setup(() => json(makeApiAnalysis({ api_version: 'v2' }), { status: 201 }))
    await expect(api.create({ inputType: 'text', text: 'a'.repeat(60) })).rejects.toMatchObject({ scenario: 'incompatible_api' })
  })
})

describe('GET /api/v1/analyses/{id}/', () => {
  it('busca pelo identificador, escapando o valor', async () => {
    const { api, fetchImpl } = setup(() => json(makeApiAnalysis()))
    await api.get('7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11')
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/analyses/7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11/')
    await api.get('../admin?x=1')
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/v1/analyses/..%2Fadmin%3Fx%3D1/')
  })

  it('análise inexistente vira o cenário not_found', async () => {
    const { api } = setup(() => json(apiErrors.notFound, { status: 404 }))
    await expect(api.get('7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11')).rejects.toMatchObject({ scenario: 'not_found' })
  })
})

describe('GET /api/v1/health/', () => {
  it('devolve o corpo de saúde sem interpretar', async () => {
    const { api } = setup(() => json({ status: 'ok', api_version: 'v1' }))
    await expect(api.health()).resolves.toEqual({ status: 'ok', api_version: 'v1' })
  })
})
