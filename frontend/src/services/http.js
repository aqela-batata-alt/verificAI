// @ts-check
// Cliente HTTP da API v1.
//
// - Prazo máximo por requisição (RNF01: 30 s). Passou do prazo, a requisição é interrompida e
//   a interface mostra o erro controlado "timeout" (RNF17: nunca fica esperando sem fim).
// - O usuário pode cancelar (RF25 pede que a interface não deixe o usuário sem saída).
// - Toda falha vira um AppError já classificado nos cenários do RF27.
// - Mesma origem por padrão (ADR-006): o cookie de sessão SameSite=Lax vai junto.

import { classifyApiFailure, incompatibleApiFailure, networkFailure, timeoutFailure } from '../domain/errors.js'

/** O usuário (ou a tela) cancelou a requisição. Não é erro para mostrar. */
export class RequestCancelled extends Error {
  constructor() {
    super('Requisição cancelada.')
    this.name = 'RequestCancelled'
  }
}

/**
 * @typedef {{
 *   baseUrl: string,
 *   timeoutMs: number,
 *   fetchImpl?: typeof fetch,
 * }} HttpClientOptions
 *
 * @typedef {{
 *   method?: 'GET' | 'POST',
 *   body?: unknown,
 *   signal?: AbortSignal,
 *   headers?: Record<string, string>,
 *   timeoutMs?: number,
 * }} RequestOptions
 */

/** @param {string | null} value @returns {number | null} */
function parseRetryAfter(value) {
  if (!value) return null
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null
}

/**
 * @param {HttpClientOptions} options
 */
export function createHttpClient({ baseUrl, timeoutMs, fetchImpl }) {
  /**
   * @param {string} path caminho depois da base, começando com "/"
   * @param {RequestOptions} [options]
   * @returns {Promise<unknown>} corpo JSON da resposta
   */
  async function request(path, { method = 'GET', body, signal, headers = {}, timeoutMs: perRequest } = {}) {
    // Cancelada antes de começar: nem chega a abrir a conexão.
    if (signal?.aborted) throw new RequestCancelled()

    const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis)
    const controller = new AbortController()
    let timedOut = false
    let cancelled = false

    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, perRequest ?? timeoutMs)

    /** Repassa o cancelamento do chamador para a requisição. */
    const onExternalAbort = () => {
      cancelled = true
      controller.abort()
    }
    signal?.addEventListener('abort', onExternalAbort, { once: true })

    /** @type {Record<string, string>} */
    const finalHeaders = { Accept: 'application/json', ...headers }
    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'

    let response
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: finalHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const parsed = await readBody(response)
      if (!response.ok) {
        throw classifyApiFailure({
          status: response.status,
          body: parsed,
          retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
        })
      }
      if (parsed === undefined) throw incompatibleApiFailure('A resposta não é JSON.')
      return parsed
    } catch (error) {
      if (timedOut) throw timeoutFailure()
      if (cancelled) throw new RequestCancelled()
      if (error instanceof Error && error.name === 'AppError') throw error
      // fetch lança TypeError quando não há resposta (rede caiu, DNS, CORS, bloqueio).
      throw networkFailure({ offline: typeof navigator !== 'undefined' && navigator.onLine === false })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onExternalAbort)
    }
  }

  return { request }
}

/**
 * Lê o corpo como JSON. Devolve undefined se não for JSON (ex.: página HTML de erro do nginx).
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readBody(response) {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
