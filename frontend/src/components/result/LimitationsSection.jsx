import Icon from '../ui/Icon.jsx'

// Limitações (RF17): ficam visíveis na página principal, sem abrir a área técnica. O texto vem
// da API; a interface não acrescenta nem remove ressalvas.

/** @param {{ limitations: string[] }} props */
export default function LimitationsSection({ limitations }) {
  if (!limitations.length) return null
  return (
    <section className="sheet sheet--pad result-section">
      <p className="section-label">O que este resultado não garante</p>
      <h2>Limitações</h2>
      <ul className="icon-list">
        {limitations.map((text) => (
          <li key={text}>
            <Icon name="info" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
