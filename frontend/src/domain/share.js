// @ts-check
// Resumo copiável do resultado (RF18).
//
// O RF18 exige: status, alegação, data da análise, limitações e links das fontes, SEM afirmar
// que houve verificação humana, e sem apresentar análise inconclusiva como conclusão definitiva.

import { formatDateTime, formatIndex } from './format.js'
import { STATUS, STATUS_INFO } from './status.js'
import { SOURCE_RELATION_LABELS, statusOf } from './analysis.js'

/**
 * @param {import('./analysis.js').Analysis} analysis
 * @param {{ productName?: string }} [options]
 * @returns {string}
 */
export function buildShareSummary(analysis, { productName = 'Apura' } = {}) {
  const code = statusOf(analysis)
  const info = STATUS_INFO[code]
  const inconclusive = code === STATUS.INCONCLUSIVE
  const lines = []

  lines.push(`${productName}: resumo da análise automática`)
  lines.push('')
  lines.push(`Status: ${info.label}`)

  if (inconclusive || analysis.riskIndex === null) {
    lines.push('Índice de risco: não calculado nesta análise.')
    lines.push(
      'Esta análise não chegou a uma conclusão. Não use este resumo para afirmar que a notícia é verdadeira nem que é falsa.',
    )
    for (const reason of analysis.abstention) lines.push(`- ${reason.message}`)
  } else {
    lines.push(
      `Índice de risco: ${formatIndex(analysis.riskIndex)} de 100 (é um indicador de risco, não a probabilidade de a notícia ser falsa).`,
    )
  }

  lines.push(`Alegação analisada: “${analysis.claim.summary}”`)
  lines.push(`Data da análise: ${formatDateTime(analysis.createdAt)}`)

  if (analysis.limitations.length) {
    lines.push('')
    lines.push('Limitações:')
    for (const item of analysis.limitations) lines.push(`- ${item}`)
  }

  lines.push('')
  const sources = analysis.evidence.sources
  if (sources.length) {
    lines.push('Fontes:')
    for (const source of sources) {
      const name = [source.publisher, source.title].filter(Boolean).join(': ') || 'Fonte sem identificação'
      const link = source.url ? ` ${source.url}` : ''
      lines.push(`- ${name} (${SOURCE_RELATION_LABELS[source.relation].toLowerCase()})${link}`)
    }
  } else {
    lines.push('Fontes: nenhuma fonte foi consultada ou apresentada nesta análise.')
  }

  lines.push('')
  lines.push('Análise feita por computador, como apoio à leitura crítica. Não houve verificação humana. Confira a fonte original antes de compartilhar.')
  return lines.join('\n')
}
