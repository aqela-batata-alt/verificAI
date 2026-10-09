import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import ToastRegion from '../components/ui/ToastRegion.jsx'

/**
 * @typedef {{
 *   id: number,
 *   message: string,
 *   tone: 'info' | 'success' | 'error',
 *   action: { label: string, onAction?: () => void, to?: string } | null,
 *   duration: number | null,
 * }} ToastItem
 */

const ToastContext = createContext(
  /** @type {{ show: (toast: Partial<Omit<ToastItem, 'id'>> & { message: string, persistent?: boolean }) => number, dismiss: (id: number) => void } | null} */ (null),
)

// Avisos com ação ficam mais tempo; avisos importantes (persistent) só saem quando a pessoa
// fecha. Nada some em poucos segundos (NN/g: pessoas mais velhas leem mais devagar; WCAG 2.2.1).
const DEFAULT_DURATION = 8_000
const ACTION_DURATION = 15_000

let nextId = 1

/** @param {{ children: import('react').ReactNode }} props */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {ToastItem[]} */ ([]))

  const dismiss = useCallback((/** @type {number} */ id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (/** @type {Partial<Omit<ToastItem, 'id'>> & { message: string, persistent?: boolean }} */ toast) => {
      const id = nextId++
      const action = toast.action ?? null
      const duration = toast.persistent ? null : (toast.duration ?? (action ? ACTION_DURATION : DEFAULT_DURATION))
      setToasts((current) => [...current, { id, message: toast.message, tone: toast.tone ?? 'info', action, duration }])
      return id
    },
    [],
  )

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('ToastProvider ausente.')
  return value
}
