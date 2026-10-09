import { useMemo } from 'react'
import { useServices } from '../state/services.jsx'
import { useStore } from './useStore.js'

/**
 * Histórico local (RF20, RF28).
 */
export function useHistory() {
  const { history } = useServices()
  const snapshot = useStore(history)
  return useMemo(
    () => ({
      items: snapshot.items,
      enabled: snapshot.enabled,
      /** Falso quando o navegador não deixa guardar nada (ex.: janela privada). */
      persistent: snapshot.persistent,
      remove: history.remove,
      restore: history.restore,
      clear: history.clear,
      setEnabled: history.setEnabled,
    }),
    [history, snapshot],
  )
}
