import { statusOf } from '../../domain/analysis.js'
import { STATUS_INFO } from '../../domain/status.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'

// Orientação segura (RF18). As frases vêm da API (texto fixo do back end); a interface só as
// organiza. Ficam logo depois do resultado para que, em telas pequenas, não fiquem no fim da página.

/** @param {{ analysis: import('../../domain/analysis.js').Analysis }} props */
export default function NextSteps({ analysis }) {
  const info = STATUS_INFO[statusOf(analysis)]

  return (
    <section className="side-panel side-panel--accent side-panel--wide">
      <p className="section-label">Próximo passo</p>
      <h2>{info.nextStepTitle}</h2>
      {analysis.recommendations.length ? (
        <ul className="next-steps">
          {analysis.recommendations.map((text) => (
            <li key={text}>
              <Icon name="check" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="cluster">
        <Button to="/" iconEnd="arrow">
          Verificar outro conteúdo
        </Button>
        <Button to="/historico" variant="outline">
          Consultar histórico
        </Button>
      </div>
    </section>
  )
}
