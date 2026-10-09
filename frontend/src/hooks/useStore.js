import { useEffect, useState, useSyncExternalStore } from 'react'
import { useServices } from '../state/services.jsx'

/**
 * Lê um store externo (histórico, contador, sessão) e atualiza a tela quando ele muda.
 * @template T
 * @param {{ subscribe: (listener: () => void) => () => void, getSnapshot: () => T }} store
 * @returns {T}
 */
export function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/**
 * Hora atual, atualizada a cada "intervalMs" enquanto "enabled" for verdadeiro.
 * Serve para contagens que mudam com o tempo (renovação do limite, segundos de espera).
 * @param {number} intervalMs
 * @param {boolean} [enabled]
 * @returns {number}
 */
export function useNow(intervalMs, enabled = true) {
  const { now } = useServices()
  const [current, setCurrent] = useState(() => now())
  useEffect(() => {
    if (!enabled) return undefined
    const id = setInterval(() => setCurrent(now()), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, now])
  return current
}
