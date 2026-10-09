import { useEffect, useId, useRef } from 'react'
import { ACTION_LABELS, describeError } from '../../domain/errors.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'

// Painel de erro do RF27. Cada um dos sete cenários (e os extras que a API real devolve) tem
// título, mensagem e ao menos um botão com uma ação possível. O texto vem de describeError.
//
// Estrutura copiada do resumo de erros do GOV.UK Design System: o contêiner externo recebe o
// foco (tabindex -1) e o interno é uma região role="alert", para que o leitor de tela anuncie o
// problema sem a pessoa precisar procurá-lo.
//
// Cor: erros do sistema (a pessoa não tem o que corrigir) em vermelho; o resto, em âmbar.
// O ícone e o título trazem o sentido; a cor só reforça.

const SYSTEM_SCENARIOS = new Set(['api_unavailable', 'timeout', 'incompatible_api', 'unknown'])

/** Ações que são só navegação. As demais dependem de quem mostra o painel (onAction). */
const LINK_ACTIONS = /** @type {Record<string, string>} */ ({
  new_analysis: '/',
  open_history: '/historico',
})

/**
 * @param {{
 *   error: import('../../domain/errors.js').AppError,
 *   onAction?: (action: import('../../domain/errors.js').ErrorActionId) => void,
 *   busy?: boolean,
 *   focusOnMount?: boolean,
 *   headingLevel?: 2 | 3,
 *   messageId?: string,
 *   className?: string,
 * }} props
 */
export default function ErrorPanel({
  error,
  onAction,
  busy = false,
  focusOnMount = true,
  headingLevel = 3,
  messageId,
  className,
}) {
  const view = describeError(error)
  const tone = SYSTEM_SCENARIOS.has(error.scenario) ? 'error' : 'warning'
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null))
  const generatedId = useId()
  const alertId = messageId ?? generatedId
  const Heading = /** @type {'h2' | 'h3'} */ (`h${headingLevel}`)

  // Cada erro novo (objeto novo) leva o foco de volta ao painel.
  useEffect(() => {
    if (focusOnMount) ref.current?.focus()
  }, [error, focusOnMount])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={['error-panel', `error-panel--${tone}`, className].filter(Boolean).join(' ')}
      data-scenario={error.scenario}
    >
      <div id={alertId} role="alert" className="error-panel__alert">
        <div className="error-panel__head">
          <Icon name={tone === 'error' ? 'status-high' : 'status-attention'} size={24} />
          <Heading className="error-panel__title">{view.title}</Heading>
        </div>
        <p className="error-panel__message">{view.message}</p>
      </div>
      <div className="error-panel__actions">
        {view.actions.map((action, index) => {
          const variant = index === 0 ? 'primary' : 'outline'
          const to = LINK_ACTIONS[action]
          return to ? (
            <Button key={action} variant={variant} to={to}>
              {ACTION_LABELS[action]}
            </Button>
          ) : (
            <Button key={action} variant={variant} disabled={busy} onClick={() => onAction?.(action)}>
              {ACTION_LABELS[action]}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
