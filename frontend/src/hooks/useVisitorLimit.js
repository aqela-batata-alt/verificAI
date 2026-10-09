import { VISITOR_LIMIT } from '../domain/limits.js'
import { refresh, remaining as remainingAt, renewsAt as renewsAtFn } from '../domain/visitorLimit.js'
import { useServices } from '../state/services.jsx'
import { useAuth } from './useAuth.js'
import { useNow, useStore } from './useStore.js'

/**
 * Limite de visitante (RF33): três análises em 24 h por navegador. Quem entrou numa conta não
 * tem esse limite.
 */
export function useVisitorLimit() {
  const { visitorLimit } = useServices()
  const { signedIn } = useAuth()
  const state = useStore(visitorLimit)
  // Só precisa de relógio enquanto existe uma janela aberta.
  const now = useNow(30_000, state.windowStart !== null)

  const isVisitor = !signedIn
  const current = refresh(state, now)
  const remaining = remainingAt(state, now)
  const renewsAt = renewsAtFn(state, now)

  return {
    isVisitor,
    max: VISITOR_LIMIT.max,
    remaining,
    used: current.count,
    /** Momento (ms desde a época) em que o uso como visitante é liberado de novo, ou null. */
    renewsAt,
    msUntilRenewal: renewsAt === null ? null : Math.max(0, renewsAt - now),
    canStart: !isVisitor || remaining > 0,
  }
}
