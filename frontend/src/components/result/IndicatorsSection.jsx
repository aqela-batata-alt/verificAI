import { formatNumber, formatPercent } from '../../domain/format.js'

// Indicadores linguísticos (RF10): sinais auxiliares, rotulados como indicadores e nunca como
// prova. As definições seguem o cálculo do back end (rules-v1.0.0): "caixa alta" é a fração de
// palavras com três letras ou mais escritas só em maiúsculas.

/** @param {{ indicators: import('../../domain/analysis.js').Indicators }} props */
export default function IndicatorsSection({ indicators }) {
  const { capsRatio, exclamations, repeatedPunctuation, sensationalTerms } = indicators

  return (
    <section className="sheet sheet--pad result-section">
      <p className="section-label">Detectado no texto</p>
      <h2>Indicadores de linguagem</h2>
      <p className="result-section__lead">
        Sinais auxiliares sobre a forma como o texto foi escrito. Sozinhos, eles não provam que o conteúdo é verdadeiro
        nem que é falso.
      </p>
      <dl className="facts">
        <dt>Palavras em caixa alta</dt>
        <dd>{formatPercent(capsRatio)} das palavras com 3 letras ou mais</dd>
        <dt>Pontos de exclamação</dt>
        <dd>{formatNumber(exclamations)}</dd>
        <dt>Sequências repetidas de ! ou ?</dt>
        <dd>{formatNumber(repeatedPunctuation)}</dd>
        <dt>Expressões apelativas</dt>
        <dd>
          {sensationalTerms.length ? (
            <ul className="chips" aria-label="Expressões apelativas encontradas">
              {sensationalTerms.map((term) => (
                <li className="chip" key={term}>
                  {term}
                </li>
              ))}
            </ul>
          ) : (
            'Nenhuma encontrada'
          )}
        </dd>
      </dl>
    </section>
  )
}
