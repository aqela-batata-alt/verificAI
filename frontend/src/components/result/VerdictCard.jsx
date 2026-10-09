import { statusOf } from '../../domain/analysis.js'
import { formatDateTime, formatNumber, formatPercent } from '../../domain/format.js'
import { STATUS, STATUS_INFO } from '../../domain/status.js'
import Notice from '../ui/Notice.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import RiskScale from './RiskScale.jsx'

// Resultado principal (RF16, RF26): status em linguagem simples primeiro, índice depois, e a
// alegação analisada junto. O que é técnico fica mais abaixo.

/** @param {{ analysis: import('../../domain/analysis.js').Analysis }} props */
export default function VerdictCard({ analysis }) {
  const code = statusOf(analysis)
  const info = STATUS_INFO[code]
  const inconclusive = code === STATUS.INCONCLUSIVE
  const { model, claim } = analysis
  const partial = model.fullyAnalyzed === false

  return (
    <section className="sheet">
      <div className="verdict-banner dark-panel">
        <div>
          <p className="eyebrow">Resultado da análise</p>
          <p>Análise automática feita em {formatDateTime(analysis.createdAt)}</p>
        </div>
        <span className="verdict-banner__mark" aria-hidden="true">
          Apura
        </span>
      </div>

      <div className="verdict">
        <div>
          <StatusBadge code={code} />
          <h2>{info.label}</h2>
          <p>{info.summary}</p>
        </div>
        {!inconclusive && analysis.riskIndex !== null ? (
          <RiskScale value={analysis.riskIndex} />
        ) : (
          <div className="verdict__none">
            <strong>Sem índice</strong>
            <span>Numa análise inconclusiva o índice de risco não é calculado.</span>
          </div>
        )}
      </div>

      <p className="score-note">
        {inconclusive
          ? 'Esta análise não chegou a uma conclusão. Isso não quer dizer que a notícia seja verdadeira nem que seja falsa.'
          : 'O índice é um indicador de risco. Ele não é a probabilidade de a notícia ser falsa nem uma certeza.'}
      </p>

      {model && model.fakeProbability !== null ? (
        <div className="model-prob-card">
          <div className="model-prob-card__header">
            <div>
              <p className="model-prob-card__eyebrow">Probabilidade calculada pelo modelo</p>
              <p className="model-prob-card__headline">
                {model.fakeProbability >= 0.5 ? (
                  <>
                    <strong>{formatPercent(model.fakeProbability)}</strong> de chance de ser <strong>falsa</strong>
                  </>
                ) : (
                  <>
                    <strong>{formatPercent(Math.max(0, 1 - model.fakeProbability))}</strong> de chance de ser <strong>verdadeira</strong>
                  </>
                )}
              </p>
            </div>
            {model.confidence !== null ? (
              <span className="model-prob-card__confidence">
                Confiança estatística: {formatPercent(model.confidence)}
              </span>
            ) : null}
          </div>

          <div
            className="model-prob-card__track"
            role="progressbar"
            aria-valuenow={Math.round(model.fakeProbability * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Probabilidade calculada pelo modelo de ser falsa"
          >
            <span
              className="model-prob-card__fill model-prob-card__fill--true"
              style={{ width: `${Math.round(Math.max(0, 1 - model.fakeProbability) * 100)}%` }}
            />
            <span
              className="model-prob-card__fill model-prob-card__fill--fake"
              style={{ width: `${Math.round(model.fakeProbability * 100)}%` }}
            />
          </div>

          <div className="model-prob-card__breakdown">
            <span className="model-prob-card__label-true">
              Chance de ser verdadeira: <strong>{formatPercent(Math.max(0, 1 - model.fakeProbability))}</strong>
            </span>
            <span className="model-prob-card__label-fake">
              Chance de ser falsa: <strong>{formatPercent(model.fakeProbability)}</strong>
            </span>
          </div>
        </div>
      ) : null}

      {partial ? (
        <div className="verdict__partial">
          <Notice tone="warning" title="Só uma parte do texto foi analisada.">
            {model.chunksAnalyzed !== null && model.chunksTotal !== null
              ? `Foram analisados ${formatNumber(model.chunksAnalyzed)} de ${formatNumber(model.chunksTotal)} trechos. `
              : ''}
            O resultado considera apenas a parte analisada.
          </Notice>
        </div>
      ) : null}

      <div className="claim">
        <p className="section-label">Alegação analisada</p>
        <blockquote>
          <p>{claim.summary ? `“${claim.summary}”` : 'Não foi possível resumir a alegação.'}</p>
        </blockquote>
        <p className="claim__note">
          {claim.confirmedByUser
            ? 'Alegação confirmada por você.'
            : 'Resumo feito automaticamente. Ainda não é possível confirmar ou corrigir a alegação nesta versão.'}
        </p>
      </div>
    </section>
  )
}
