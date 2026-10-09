import { RESPONSE_DEADLINE_MS } from '../../domain/limits.js'
import Icon from '../ui/Icon.jsx'

/**
 * Painel azul ao lado do formulário. Só promete o que o produto faz: a explicação mostra os
 * sinais, a decisão fica com a pessoa, e a incerteza aparece escrita.
 */
export default function AnalysisAside() {
  return (
    <aside className="analysis-aside dark-panel" aria-labelledby="aside-titulo">
      <div>
        <p className="eyebrow">Além de um rótulo</p>
        <h2 id="aside-titulo">
          Menos achismo.
          <br />
          Mais contexto.
        </h2>
        <p>Uma explicação que ajuda você a entender a informação, sem decidir por você.</p>
      </div>
      <ul className="aside-list">
        <li>
          <Icon name="check" />
          Sinais explicados
        </li>
        <li>
          <Icon name="check" />A decisão é sua
        </li>
        <li>
          <Icon name="check" />
          Incertezas visíveis
        </li>
      </ul>
      <div className="time-tag">
        <strong>{Math.round(RESPONSE_DEADLINE_MS / 1000)} s</strong>
        <span>
          Prazo máximo
          <br />
          de resposta
        </span>
      </div>
    </aside>
  )
}
