import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

/**
 * Botão e link com aparência de botão. Todos têm pelo menos 48 × 48 px (RNF08).
 *
 * - sem "to" nem "href": <button> (padrão type="button", para nunca enviar formulário sem querer);
 * - com "to": link interno do roteador;
 * - com "href": link comum; "external" abre em nova aba e avisa isso a quem usa leitor de tela.
 *
 * @param {{
 *   variant?: 'primary' | 'gold' | 'outline' | 'soft' | 'danger',
 *   size?: 'normal' | 'small',
 *   block?: boolean,
 *   icon?: string,
 *   iconEnd?: string,
 *   to?: string,
 *   href?: string,
 *   external?: boolean,
 *   className?: string,
 *   type?: 'button' | 'submit' | 'reset',
 *   children?: import('react').ReactNode,
 * } & Record<string, any>} props
 */
export default function Button({
  variant = 'primary',
  size = 'normal',
  block = false,
  icon,
  iconEnd,
  to,
  href,
  external = false,
  className,
  type = 'button',
  children,
  ...rest
}) {
  const classes = [
    'btn',
    variant !== 'primary' && `btn--${variant}`,
    size === 'small' && 'btn--small',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} /> : null}
    </>
  )

  if (to) {
    return (
      <Link className={classes} to={to} {...rest}>
        {content}
      </Link>
    )
  }

  if (href) {
    const extra = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
    return (
      <a className={classes} href={href} {...extra} {...rest}>
        {content}
        {external ? <span className="sr-only"> (abre em uma nova aba)</span> : null}
      </a>
    )
  }

  return (
    <button type={type} className={classes} {...rest}>
      {content}
    </button>
  )
}
