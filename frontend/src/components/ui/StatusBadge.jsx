import { STATUS_INFO } from '../../domain/status.js'
import Icon from './Icon.jsx'

/**
 * Selo do status do resultado (RF16). Cada status tem uma forma própria (círculo com visto,
 * triângulo, octógono, círculo com interrogação) e um texto: a cor não é o único sinal.
 *
 * @param {{ code: import('../../domain/status.js').StatusCode, short?: boolean }} props
 */
export default function StatusBadge({ code, short = false }) {
  const info = STATUS_INFO[code]
  return (
    <span className={`pill pill--${info.tone}`}>
      <Icon name={`status-${info.tone}`} size={16} />
      <span>{short ? info.shortLabel : info.label}</span>
    </span>
  )
}
