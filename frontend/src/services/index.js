// @ts-check
// Monta os serviços da aplicação. É o único lugar que decide qual implementação usar
// (HTTP real da API v1, ou gateways de demonstração enquanto a Etapa 4 não existe).
// Os testes de tela montam o mesmo pacote com versões falsas.

import { config as defaultConfig } from '../config.js'
import { createAnalysesApi } from './analysesApi.js'
import { createDemoAuthGateway, createDemoFeedbackGateway } from './gateways.js'
import { createHistoryStore } from './historyStore.js'
import { createHttpClient } from './http.js'
import { createResultCache } from './resultCache.js'
import { createStorage } from './storage.js'
import { createVisitorLimitStore } from './visitorLimitStore.js'
import { getOrCreateVisitorId } from './visitor.js'

/**
 * @typedef {{
 *   config: import('../config.js').AppConfig,
 *   storage: import('./storage.js').AppStorage,
 *   analyses: ReturnType<typeof createAnalysesApi>,
 *   results: ReturnType<typeof createResultCache>,
 *   history: ReturnType<typeof createHistoryStore>,
 *   visitorLimit: ReturnType<typeof createVisitorLimitStore>,
 *   auth: import('./gateways.js').AuthGateway | null,
 *   feedback: import('./gateways.js').FeedbackGateway | null,
 *   now: () => number,
 * }} Services
 */

/**
 * @param {{
 *   config?: import('../config.js').AppConfig,
 *   storage?: import('./storage.js').AppStorage,
 *   fetchImpl?: typeof fetch,
 *   now?: () => number,
 *   auth?: import('./gateways.js').AuthGateway | null,
 *   feedback?: import('./gateways.js').FeedbackGateway | null,
 * }} [overrides]
 * @returns {Services}
 */
export function createServices(overrides = {}) {
  const config = overrides.config ?? defaultConfig
  const storage = overrides.storage ?? createStorage()
  const now = overrides.now ?? (() => Date.now())

  const http = createHttpClient({
    baseUrl: config.apiBaseUrl,
    timeoutMs: config.requestTimeoutMs,
    fetchImpl: overrides.fetchImpl,
  })

  return {
    config,
    storage,
    now,
    analyses: createAnalysesApi({ http, getVisitorId: () => getOrCreateVisitorId(storage) }),
    results: createResultCache(),
    history: createHistoryStore({ storage }),
    visitorLimit: createVisitorLimitStore({ storage, now }),
    auth: 'auth' in overrides ? (overrides.auth ?? null) : config.accountsMode === 'off' ? null : createDemoAuthGateway({ storage }),
    feedback:
      'feedback' in overrides
        ? (overrides.feedback ?? null)
        : config.feedbackMode === 'off'
          ? null
          : createDemoFeedbackGateway(),
  }
}
