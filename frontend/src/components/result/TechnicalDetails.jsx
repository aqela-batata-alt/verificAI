import { formatDateTime, formatFraction, formatNumber, formatSeconds } from '../../domain/format.js'
import Disclosure from '../ui/Disclosure.jsx'

// Área técnica (RF11, RF13, RF21): versões, saída do modelo e o cálculo do índice. Fica fechada
// por padrão, depois do resultado e das explicações (RF26: resultado principal antes dos
// detalhes técnicos). Quem precisa reproduzir a análise encontra aqui o identificador e as versões.

/** @param {Record<string, number>} values */
const listPairs = (values) =>
  Object.entries(values)
    .map(([key, value]) => `${key}: ${formatFraction(value)}`)
    .join(' · ')

/** @param {{ analysis: import('../../domain/analysis.js').Analysis }} props */
export default function TechnicalDetails({ analysis }) {
  const { versions, model, risk } = analysis

  return (
    <section className="sheet sheet--pad" aria-label="Detalhes técnicos da análise">
      <Disclosure title="Detalhes técnicos">
        <dl className="facts">
          <dt>Identificador da análise</dt>
          <dd className="facts__mono">{analysis.id}</dd>
          <dt>Criada em</dt>
          <dd>{formatDateTime(analysis.createdAt)}</dd>
          <dt>Versão da API</dt>
          <dd>{analysis.apiVersion}</dd>
          <dt>Modelo</dt>
          <dd>{versions.model || 'não informado'}</dd>
          {versions.modelSha256 ? (
            <>
              <dt>Integridade do modelo (SHA-256)</dt>
              <dd className="facts__mono">{versions.modelSha256}</dd>
            </>
          ) : null}
          <dt>Regras de cálculo</dt>
          <dd>{versions.rules || 'não informado'}</dd>
          <dt>Calibrador</dt>
          <dd>
            {versions.calibrator || 'não informado'}
            {model.calibrated ? '' : ' (a confiança do modelo não foi calibrada)'}
          </dd>
          <dt>Esquema de dados</dt>
          <dd>{versions.schema || 'não informado'}</dd>
          <dt>Código</dt>
          <dd className="facts__mono">{versions.code || 'não informado'}</dd>

          <dt>Saída do modelo</dt>
          <dd>
            {model.label ? `classe “${model.label}”` : 'sem classe'}
            {model.fakeProbability !== null
              ? ` · pontuação bruta ${formatFraction(model.fakeProbability)}`
              : ''}
            {model.confidence !== null ? ` · confiança ${formatFraction(model.confidence)}` : ''}
            {' (não é a probabilidade de a notícia ser falsa)'}
          </dd>
          {model.chunksTotal !== null ? (
            <>
              <dt>Trechos analisados</dt>
              <dd>
                {formatNumber(model.chunksAnalyzed ?? 0)} de {formatNumber(model.chunksTotal)}
                {model.aggregation ? ` · agregação: ${model.aggregation}` : ''}
              </dd>
            </>
          ) : null}
          {model.tokensTotal !== null ? (
            <>
              <dt>Tokens analisados</dt>
              <dd>
                {formatNumber(model.tokensAnalyzed ?? 0)} de {formatNumber(model.tokensTotal)}
              </dd>
            </>
          ) : null}

          <dt>Sinais usados no índice</dt>
          <dd>{Object.keys(risk.signalsUsed).length ? listPairs(risk.signalsUsed) : 'nenhum'}</dd>
          <dt>Sinais ausentes</dt>
          <dd>{risk.signalsMissing.length ? risk.signalsMissing.join(' · ') : 'nenhum'}</dd>
          <dt>Pesos</dt>
          <dd>{Object.keys(risk.weights).length ? listPairs(risk.weights) : 'não informado'}</dd>
          {risk.formula ? (
            <>
              <dt>Fórmula</dt>
              <dd className="facts__mono">{risk.formula}</dd>
            </>
          ) : null}
          {analysis.durationMs !== null ? (
            <>
              <dt>Duração</dt>
              <dd>{formatSeconds(analysis.durationMs)}</dd>
            </>
          ) : null}
        </dl>
      </Disclosure>
    </section>
  )
}
