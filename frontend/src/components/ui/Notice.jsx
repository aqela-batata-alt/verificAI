import Icon from './Icon.jsx'

const ICONS = { info: 'info', success: 'status-low', warning: 'status-attention', error: 'status-high' }

/**
 * Aviso em linha. Ícone e texto trazem o sentido; a cor só reforça (WCAG 1.4.1).
 * Use role="status" para avisos que aparecem depois da ação da pessoa e role="alert" só para
 * falhas que exigem atenção imediata.
 *
 * @param {{
 *   tone?: 'info' | 'success' | 'warning' | 'error',
 *   title?: string,
 *   role?: 'status' | 'alert',
 *   className?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function Notice({ tone = 'info', title, role, className, children }) {
  return (
    <div className={['notice', tone !== 'info' && `notice--${tone}`, className].filter(Boolean).join(' ')} role={role}>
      <Icon name={ICONS[tone]} />
      <div className="notice__body">
        {title ? <p className="notice__title">{title}</p> : null}
        {children}
      </div>
    </div>
  )
}
