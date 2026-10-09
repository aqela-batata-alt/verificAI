import { Link } from 'react-router-dom'
import Blocks from '../components/content/Blocks.jsx'
import PageHeading from '../components/layout/PageHeading.jsx'
import Notice from '../components/ui/Notice.jsx'
import { privacySections } from '../content/privacy.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useServices } from '../state/services.jsx'

// Privacidade (RF30): armazenamento local, contas, histórico sincronizado, limite de visitante e
// tratamento de feedback. O texto vem de src/content/privacy.js e descreve só o que o sistema faz
// hoje; o que a equipe ainda não decidiu aparece como "a definir", nunca como promessa.

export default function PrivacyPage() {
  useDocumentTitle('Privacidade')
  const { config } = useServices()
  const sections = privacySections(config)

  return (
    <div className="wrap screen appear">
      <PageHeading
        eyebrow="Privacidade sem letras miúdas"
        title="Você precisa saber o que fica."
        lead="O que o Apura envia, o que guarda, onde guarda e o que você pode apagar."
      />

      <div className="privacy-grid">
        <nav className="privacy-toc" aria-labelledby="privacidade-indice">
          <p id="privacidade-indice" className="section-label">
            Nesta página
          </p>
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <Link to={{ hash: `#${section.id}` }}>{section.title}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="privacy-body">
          <Notice tone="warning">
            Este texto descreve o que o sistema faz hoje. Ele ainda precisa de revisão jurídica e de algumas decisões da
            equipe, listadas no fim da página, antes de valer como política final.
          </Notice>

          {sections.map((section) => (
            <section className="privacy-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-titulo`}>
              <h2 id={`${section.id}-titulo`} tabIndex={-1}>
                {section.title}
              </h2>
              <div className="prose">
                <Blocks blocks={section.blocks} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
