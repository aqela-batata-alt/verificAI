import Blocks from '../components/content/Blocks.jsx'
import PageHeading from '../components/layout/PageHeading.jsx'
import Button from '../components/ui/Button.jsx'
import Disclosure from '../components/ui/Disclosure.jsx'
import Icon from '../components/ui/Icon.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { BAND_RANGES, howFaq, howSections, howSteps } from '../content/how.js'
import { STATUS_CODES, STATUS_INFO } from '../domain/status.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useServices } from '../state/services.jsx'

// "Como funciona" (RF30): finalidade, funcionamento geral, significado do índice, uso de fontes e
// limitações. O texto vem de src/content/how.js, que muda conforme o que o back end já faz
// (config.backend) e é conferido por testes.
//
// Ordem: para que serve → passos do método → como ler o índice e as categorias → quando fica
// inconclusiva → fontes → limitações → perguntas frequentes. Cada seção é um bloco curto com título,
// para a pessoa achar o que procura (Krug: quem lê na web percorre, não lê tudo).

export default function HowPage() {
  useDocumentTitle('Como funciona')
  const { config } = useServices()

  const steps = howSteps(config)
  const sections = howSections(config)
  const faq = howFaq(config)

  const purpose = sections.find((section) => section.id === 'finalidade')
  const others = sections.filter((section) => section.id !== 'finalidade')

  return (
    <div className="wrap screen appear">
      <PageHeading
        eyebrow="Nosso método"
        title="Verificar é ir além da manchete."
        lead="O Apura é um apoio à leitura crítica, não uma autoridade infalível sobre a verdade."
      />

      {purpose ? (
        <section className="how-purpose" id={purpose.id} aria-labelledby={`${purpose.id}-titulo`}>
          <h2 id={`${purpose.id}-titulo`} tabIndex={-1}>
            {purpose.title}
          </h2>
          <div className="prose">
            <Blocks blocks={purpose.blocks} />
          </div>
        </section>
      ) : null}

      <section className="explainer-grid" aria-labelledby="passos-titulo">
        <div>
          <h2 id="passos-titulo" className="how-subtitle" tabIndex={-1}>
            Como a análise funciona
          </h2>
          <ol className="steps">
            {steps.map((step, index) => (
              <li className="step-card" key={step.title}>
                <span className="step-card__no" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="method-visual dark-panel" aria-label="Resumo do método">
          <div>
            <p className="eyebrow">Um segundo olhar</p>
            <h2>
              A informação
              <br />
              importa. O contexto,
              <br />
              também.
            </h2>
            <p>Uma análise responsável mostra o que encontrou e os seus limites.</p>
          </div>
          <ul className="method-flow" aria-label="Etapas: conteúdo, sinais, explicação">
            <li>
              <Icon name="text" />
              Conteúdo
            </li>
            <li aria-hidden="true">→</li>
            <li>
              <Icon name="search" />
              Sinais
            </li>
            <li aria-hidden="true">→</li>
            <li>
              <Icon name="document" />
              Explicação
            </li>
          </ul>
          <Button to="/" variant="gold" iconEnd="arrow">
            Testar uma verificação
          </Button>
        </aside>
      </section>

      {others.map((section) => (
        <section className="how-block" id={section.id} key={section.id} aria-labelledby={`${section.id}-titulo`}>
          <h2 id={`${section.id}-titulo`} className="how-subtitle" tabIndex={-1}>
            {section.title}
          </h2>
          <div className="prose">
            <Blocks blocks={section.blocks} />
          </div>
          {section.id === 'indice' ? (
            <div className="how-legend">
              <h3 className="section-label">Como ler as categorias</h3>
              <ul className="risk-legend">
                {STATUS_CODES.map((code) => (
                  <li className={`risk-card risk-card--${STATUS_INFO[code].tone}`} key={code}>
                    <StatusBadge code={code} />
                    <p className="risk-card__range">{BAND_RANGES[code]}</p>
                    <p>{STATUS_INFO[code].summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      <section className="faqs" aria-labelledby="faq-titulo">
        <h2 id="faq-titulo" tabIndex={-1}>
          Transparência também é parte do método.
        </h2>
        {faq.map((item) => (
          <Disclosure key={item.question} title={item.question}>
            <p>{item.answer}</p>
          </Disclosure>
        ))}
      </section>
    </div>
  )
}
