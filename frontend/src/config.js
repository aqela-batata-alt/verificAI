// @ts-check
// Configuração da interface, lida das variáveis VITE_* (veja .env.example).
//
// RNF16: tudo aqui vai para o pacote enviado ao navegador. Nunca coloque segredo.

import { RESPONSE_DEADLINE_MS } from './domain/limits.js'

/** @typedef {'demo' | 'off'} FeatureMode */

/**
 * @typedef {{
 *   apiBaseUrl: string,
 *   requestTimeoutMs: number,
 *   urlInput: boolean,
 *   accountsMode: FeatureMode,
 *   feedbackMode: FeatureMode,
 *   backend: { urlAnalysis: boolean, sources: boolean },
 * }} AppConfig
 */

/** @param {string | undefined} value @param {boolean} fallback */
const toBool = (value, fallback) => (value === undefined || value === '' ? fallback : value === 'true')

/** @param {string | undefined} value @param {number} fallback */
const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** @param {string | undefined} value @returns {FeatureMode} */
const toMode = (value) => (value === 'off' ? 'off' : 'demo')

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {AppConfig}
 */
export function createConfig(env = import.meta.env) {
  return Object.freeze({
    apiBaseUrl: (env.VITE_API_BASE_URL || '/api').replace(/\/+$/, ''),
    requestTimeoutMs: toPositiveNumber(env.VITE_REQUEST_TIMEOUT_MS, RESPONSE_DEADLINE_MS),
    urlInput: toBool(env.VITE_FEATURE_URL_INPUT, true),
    accountsMode: toMode(env.VITE_ACCOUNTS_MODE),
    feedbackMode: toMode(env.VITE_FEEDBACK_MODE),
    // O que o back end já faz hoje. Só muda textos explicativos (Como funciona e Privacidade),
    // para que eles continuem descrevendo o que o sistema realmente faz (RF30). Ligue quando a
    // Etapa 2 (análise por link) e a Etapa 3 (consulta a fontes) forem publicadas.
    backend: {
      urlAnalysis: toBool(env.VITE_BACKEND_URL_ANALYSIS, false),
      sources: toBool(env.VITE_BACKEND_SOURCES, false),
    },
  })
}

export const config = createConfig()
