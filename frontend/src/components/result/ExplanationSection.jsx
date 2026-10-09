import { statusOf } from '../../domain/analysis.js'
import { STATUS } from '../../domain/status.js'
import Icon from '../ui/Icon.jsx'

// Explicação dos fatores (RF17): o texto vem da API, em linguagem não técnica. Quando a análise
// é inconclusiva, os motivos da abstenção (RF14) vêm primeiro, cada um com a sua mensagem.
// Os símbolos são neutros de propósito: parte das frases são ressalvas, e marcá-las com "!"
// diria que são alertas.

/** @param {{ analysis: import('../../domain/analysis.js').Analysis }} props */
export default function ExplanationSection({ analysis }) {
  const inconclusive = statusOf(analysis) === STATUS.INCONCLUSIVE
  const reasons = analysis.abstention.map((item) => item.message)
  const factors = analysis.explanation.filter((text) => !reasons.includes(text))

  return (
    <section className="sheet sheet--pad result-section">
      <p className="section-label">Os sinais por trás do resultado</p>
      <h2>{inconclusive ? 'Por que não foi possível concluir' : 'Por que esse resultado?'}</h2>
      <p className="result-section__lead">Os principais fatores da análise automática, em linguagem simples.</p>

      {reasons.length || factors.length ? (
        <ul>
          {reasons.map((text) => (
            <li className="signal" key={`motivo-${text}`}>
              <span className="signal__symbol signal__symbol--inconclusive">
                <Icon name="status-inconclusive" />
              </span>
              <p>{text}</p>
            </li>
          ))}
          {factors.map((text) => (
            <li className="signal" key={`fator-${text}`}>
              <span className="signal__symbol signal__symbol--neutral">
                <Icon name="info" />
              </span>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Esta resposta não trouxe uma explicação em texto.</p>
      )}
    </section>
  )
}
