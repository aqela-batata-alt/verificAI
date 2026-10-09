import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../domain/errors.js'
import { apiErrors, makeApiAnalysis } from '../test/fixtures.js'
import { RequestCancelled, createHttpClient } from './http.js'

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })

/** fetch que nunca responde, mas respeita o cancelamento (como o fetch de verdade). */
const hangingFetch = () =>
  vi.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
  )

const client = (fetchImpl, timeoutMs = 30_000) => createHttpClient({ baseUrl: '/api', timeoutMs, fetchImpl })

const failureOf = async (promise) => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('A chamada deveria ter falhado.')
}

describe('cliente HTTP', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('envia JSON na mesma origem, sem cache, e devolve o corpo', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: true }))
    const result = await client(fetchImpl).request('/v1/x/', { method: 'POST', body: { a: 1 }, headers: { 'X-Teste': '1' } })
    expect(result).toEqual({ ok: true })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/v1/x/')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', body: '{"a":1}' })
    expect(init.headers).toMatchObject({ Accept: 'application/json', 'Content-Type': 'application/json', 'X-Teste': '1' })
  })

  it('GET não envia corpo nem Content-Type', async () => {
    const fetchImpl = vi.fn(async () => json({}))
    await client(fetchImpl).request('/v1/health/')
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('erro HTTP vira AppError classificado pelo código estável da API', async () => {
    const fetchImpl = vi.fn(async () => json(apiErrors.textTooShort, { status: 400 }))
    const error = await failureOf(client(fetchImpl).request('/v1/analyses/', { method: 'POST', body: {} }))
    expect(error).toBeInstanceOf(AppError)
    expect(error.scenario).toBe('text_insufficient')
    expect(error.status).toBe(400)
    expect(error.details).toMatchObject({ length: 12, min_chars: 50 })
  })

  it('429 usa o cabeçalho Retry-After', async () => {
    const fetchImpl = vi.fn(async () => json(apiErrors.throttled, { status: 429, headers: { 'Retry-After': '12' } }))
    const error = await failureOf(client(fetchImpl).request('/x'))
    expect(error.scenario).toBe('rate_limited')
    expect(error.retryAfterSeconds).toBe(12)
  })

  it('página de erro em HTML do nginx (502) vira indisponibilidade da API', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    const error = await failureOf(client(fetchImpl).request('/x'))
    expect(error.scenario).toBe('api_unavailable')
  })

  it('504 do nginx (passou de 35 s no servidor) vira tempo limite excedido', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>504</html>', { status: 504 }))
    const error = await failureOf(client(fetchImpl).request('/x'))
    expect(error.scenario).toBe('timeout')
  })

  it('sucesso com corpo que não é JSON é incompatibilidade, não resultado', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>ok</html>', { status: 200 }))
    const error = await failureOf(client(fetchImpl).request('/x'))
    expect(error.scenario).toBe('incompatible_api')
  })

  it('falha de rede (fetch lança TypeError) vira indisponibilidade da API', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await failureOf(client(fetchImpl).request('/x'))
    expect(error.scenario).toBe('api_unavailable')
    expect(error.details.offline).toBe(false)
  })

  it('sem conexão com a internet, a falha avisa que está offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await failureOf(client(fetchImpl).request('/x'))
    expect(error.details.offline).toBe(true)
  })

  it('RNF01: passou do prazo de 30 s, interrompe a requisição e devolve o erro "timeout"', async () => {
    const fetchImpl = hangingFetch()
    const pending = failureOf(client(fetchImpl, 30_000).request('/v1/analyses/', { method: 'POST', body: {} }))
    await vi.advanceTimersByTimeAsync(29_999)
    // Ainda dentro do prazo: nada aconteceu.
    let settled = false
    pending.then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const error = await pending
    expect(error).toBeInstanceOf(AppError)
    expect(error.scenario).toBe('timeout')
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('o prazo vale por requisição e pode ser reduzido', async () => {
    const fetchImpl = hangingFetch()
    const pending = failureOf(client(fetchImpl, 30_000).request('/x', { timeoutMs: 1_000 }))
    await vi.advanceTimersByTimeAsync(1_000)
    expect((await pending).scenario).toBe('timeout')
  })

  it('cancelar pela tela interrompe a requisição e não vira erro para exibir', async () => {
    const fetchImpl = hangingFetch()
    const controller = new AbortController()
    const pending = failureOf(client(fetchImpl).request('/x', { signal: controller.signal }))
    controller.abort()
    expect(await pending).toBeInstanceOf(RequestCancelled)
  })

  it('já cancelado antes de começar: nem chega a esperar a resposta', async () => {
    const fetchImpl = hangingFetch()
    const controller = new AbortController()
    controller.abort()
    expect(await failureOf(client(fetchImpl).request('/x', { signal: controller.signal }))).toBeInstanceOf(RequestCancelled)
  })

  it('limpa o temporizador depois de responder (sem vazamento)', async () => {
    const fetchImpl = vi.fn(async () => json(makeApiAnalysis()))
    await client(fetchImpl).request('/x')
    expect(vi.getTimerCount()).toBe(0)
  })
})
