import Icon from './Icon.jsx'

/**
 * Bloco que abre e fecha, sobre <details>: funciona sem JavaScript, com teclado e leitor de tela.
 *
 * @param {{
 *   title: string,
 *   defaultOpen?: boolean,
 *   className?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function Disclosure({ title, defaultOpen = false, className, children }) {
  return (
    <details className={['disclosure', className].filter(Boolean).join(' ')} open={defaultOpen || undefined}>
      <summary>
        <span>{title}</span>
        <Icon name="chevron-down" className="icon disclosure__chevron" />
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  )
}
