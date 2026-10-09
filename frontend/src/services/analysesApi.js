// @ts-check
// Chamadas à API v1 de análises (RF29).
//
//   POST /api/v1/analyses/        cria a análise (síncrono; 201 com o resultado)
//   GET  /api/v1/analyses/{id}/   recupera o resultado e as versões usadas
//   GET  /api/v1/health/          disponibilidade
//
// O corpo do POST leva só a opção escolhida (RF24): texto OU endereço.

import { normalizeAnalysis } from '../domain/analysis.js'
import { VISITOR_HEADER } from './visitor.js'

/**
 * @typedef {{ inputType: 'text', text: string } | { inputType: 'url', url: string }} AnalysisInput
 */

/**
 * @param {{
 *   http: ReturnType<typeof import('./http.js').createHttpClient>,
 *   getVisitorId: () => string,
 * }} deps
 */
export function createAnalysesApi({ http, getVisitorId }) {
  return {
    /**
     * @param {AnalysisInput} input já validado
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<import('../domain/analysis.js').Analysis>}
     */
    async create(input, { signal } = {}) {
      const body =
        input.inputType === 'url'
          ? { input_type: 'url', url: input.url }
          : { input_type: 'text', text: input.text }
      const data = await http.request('/v1/analyses/', {
        method: 'POST',
        body,
        signal,
        headers: { [VISITOR_HEADER]: getVisitorId() },
      })
      return normalizeAnalysis(data)
    },

    /**
     * @param {string} id
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<import('../domain/analysis.js').Analysis>}
     */
    async get(id, { signal } = {}) {
      const data = await http.request(`/v1/analyses/${encodeURIComponent(id)}/`, { signal })
      return normalizeAnalysis(data)
    },

    /**
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<unknown>}
     */
    health({ signal } = {}) {
      return http.request('/v1/health/', { signal })
    },
  }
}
