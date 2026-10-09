// @ts-check
// Contador do limite de visitante guardado no navegador (RF33, RNF19).
// Guarda só { windowStart, count }: nenhum texto analisado, nenhum dado pessoal.

import { EMPTY_LIMIT_STATE, canStart, parseLimitState, registerCounted, remaining, renewsAt } from '../domain/visitorLimit.js'
import { STORAGE_KEYS } from './storage.js'

/**
 * @param {{ storage: import('./storage.js').AppStorage, now?: () => number }} deps
 */
export function createVisitorLimitStore({ storage, now = () => Date.now() }) {
  /** @type {string | null | undefined} */
  let lastRaw
  /** @type {import('../domain/visitorLimit.js').VisitorLimitState} */
  let cached = EMPTY_LIMIT_STATE

  function getSnapshot() {
    const raw = storage.getString(STORAGE_KEYS.visitorLimit)
    if (raw !== lastRaw) {
      lastRaw = raw
      let parsed = null
      try {
        parsed = raw === null ? null : JSON.parse(raw)
      } catch {
        parsed = null
      }
      cached = parseLimitState(parsed)
    }
    return cached
  }

  return {
    /** @param {() => void} listener */
    subscribe: (listener) => storage.subscribe(STORAGE_KEYS.visitorLimit, listener),
    getSnapshot,
    /** Análises que ainda podem ser feitas agora. */
    remaining: (at = now()) => remaining(getSnapshot(), at),
    canStart: (at = now()) => canStart(getSnapshot(), at),
    /** Momento em que o uso como visitante é liberado de novo, ou null. */
    renewsAt: (at = now()) => renewsAt(getSnapshot(), at),
    /**
     * Conta uma análise que terminou com resultado ou análise inconclusiva (RF33).
     * Validação rejeitada e falha técnica NÃO chamam este método.
     */
    registerCounted(at = now()) {
      storage.setJSON(STORAGE_KEYS.visitorLimit, registerCounted(getSnapshot(), at))
    },
  }
}
