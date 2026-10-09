/**
 * Cabeçalho de página: linha de contexto, título (h1), frase de apoio e, se houver, uma ação.
 * O h1 recebe foco quando a pessoa troca de página (veja Layout), por isso tem tabIndex -1.
 *
 * @param {{
 *   eyebrow?: string,
 *   title: string,
 *   lead?: string,
 *   action?: import('react').ReactNode,
 * }} props
 */
export default function PageHeading({ eyebrow, title, lead, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 tabIndex={-1}>{title}</h1>
        {lead ? <p className="page-heading__lead">{lead}</p> : null}
      </div>
      {action ? <div className="page-heading__action">{action}</div> : null}
    </div>
  )
}
