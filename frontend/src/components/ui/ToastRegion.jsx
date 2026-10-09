import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

/**
 * Avisos curtos. Dois contêineres permanentes (um educado, outro assertivo) para que leitores
 * de tela anunciem cada aviso novo. Nenhum aviso some sozinho em poucos segundos e todos podem
 * ser pausados (passar o mouse ou focar) e fechados (NN/g, WCAG 2.2.1).
 * @param {{ toasts: import('../../state/toast.jsx').ToastItem[], onDismiss: (id: number) => void }} props
 */
export default function ToastRegion({ toasts, onDismiss }) {
  const polite = toasts.filter((toast) => toast.tone !== 'error')
  const assertive = toasts.filter((toast) => toast.tone === 'error')
  return (
    <div className="toast-region">
      <div role="status" aria-live="polite" aria-relevant="additions text" className="toast-stack">
        {polite.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="toast-stack">
        {assertive.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  )
}

/** @param {{ toast: import('../../state/toast.jsx').ToastItem, onDismiss: (id: number) => void }} props */
function Toast({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (toast.duration === null || paused) return undefined
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, toast.id, paused, onDismiss])

  const { action } = toast
  return (
    <div
      className={`toast toast--${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="toast__message">{toast.message}</p>
      {action?.to ? (
        <Link className="toast__action" to={action.to} onClick={() => onDismiss(toast.id)}>
          {action.label}
        </Link>
      ) : null}
      {action && !action.to ? (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            action.onAction?.()
            onDismiss(toast.id)
          }}
        >
          {action.label}
        </button>
      ) : null}
      <button type="button" className="toast__close" aria-label="Fechar aviso" onClick={() => onDismiss(toast.id)}>
        <Icon name="close" />
      </button>
    </div>
  )
}
