// @ts-check
// Limite de visitante (RF33): três análises por navegador em uma janela de 24 horas.
//
// Regras do RF33 implementadas aqui, todas como funções puras (o relógio entra por parâmetro):
//  - a janela começa na primeira análise contabilizada e dura 24 h;
//  - texto e URL usam o mesmo contador;
//  - só conta quem termina com resultado ou análise inconclusiva (validação rejeitada e falha
//    técnica não chamam registerCounted);
//  - passadas 24 h da primeira análise contabilizada, o contador volta a zero.
//
// IMPORTANTE (RNF19): este controle é do navegador. Limpar o armazenamento do navegador
// reinicia a contagem, e é um risco conhecido do MVP. A trava de verdade vem do servidor
// (Etapa 4), que já recebe o identificador anônimo no cabeçalho X-Visitor-Id.

import { VISITOR_LIMIT } from './limits.js'

/** @typedef {{ windowStart: number | null, count: number }} VisitorLimitState */

/** @type {Readonly<VisitorLimitState>} */
export const EMPTY_LIMIT_STATE = Object.freeze({ windowStart: null, count: 0 })

/** Tolerância para relógio do aparelho voltado para trás (1 minuto). */
const CLOCK_SKEW_MS = 60_000

/**
 * Lê o estado guardado, descartando qualquer coisa fora do formato esperado.
 * @param {unknown} raw
 * @returns {VisitorLimitState}
 */
export function parseLimitState(raw) {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_LIMIT_STATE }
  const { windowStart, count } = /** @type {Record<string, unknown>} */ (raw)
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return { ...EMPTY_LIMIT_STATE }
  // Sem início de janela não há contagem válida (estado incoerente volta ao zero).
  if (typeof windowStart !== 'number' || !Number.isFinite(windowStart)) return { ...EMPTY_LIMIT_STATE }
  return { windowStart, count }
}

/**
 * Aplica a renovação: passadas 24 h do início da janela, o contador reinicia.
 * @param {VisitorLimitState} state
 * @param {number} now milissegundos desde a época
 * @returns {VisitorLimitState}
 */
export function refresh(state, now) {
  if (state.windowStart === null) return state
  const elapsed = now - state.windowStart
  // Início no futuro (relógio mudado): descarta em vez de travar o visitante.
  if (elapsed < -CLOCK_SKEW_MS) return { ...EMPTY_LIMIT_STATE }
  if (elapsed >= VISITOR_LIMIT.windowMs) return { ...EMPTY_LIMIT_STATE }
  return state
}

/**
 * @param {VisitorLimitState} state
 * @param {number} now
 * @returns {number} análises que ainda podem ser feitas agora (0 a 3)
 */
export function remaining(state, now) {
  return Math.max(0, VISITOR_LIMIT.max - refresh(state, now).count)
}

/**
 * @param {VisitorLimitState} state
 * @param {number} now
 */
export function canStart(state, now) {
  return remaining(state, now) > 0
}

/**
 * Registra uma análise que terminou com resultado ou análise inconclusiva.
 * @param {VisitorLimitState} state
 * @param {number} now
 * @returns {VisitorLimitState}
 */
export function registerCounted(state, now) {
  const current = refresh(state, now)
  return { windowStart: current.windowStart ?? now, count: current.count + 1 }
}

/**
 * Momento em que o uso como visitante é liberado de novo (RF33), ou null se não há janela.
 * @param {VisitorLimitState} state
 * @param {number} now
 * @returns {number | null}
 */
export function renewsAt(state, now) {
  const current = refresh(state, now)
  return current.windowStart === null ? null : current.windowStart + VISITOR_LIMIT.windowMs
}
