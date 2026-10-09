// @ts-check
// Status do resultado em linguagem simples (RF16) e faixas do índice de risco.
//
// Os textos de cada categoria vêm do protótipo v2 (seção "Como ler as categorias"); o código
// do status vem da API (rules-v1.0.0) e é a fonte da verdade para o rótulo principal.

/** @typedef {'poucos_sinais_de_risco'|'requer_atencao'|'alto_risco'|'analise_inconclusiva'} StatusCode */
/** @typedef {'low'|'attention'|'high'|'inconclusive'} Tone */

export const STATUS = Object.freeze({
  LOW: /** @type {const} */ ('poucos_sinais_de_risco'),
  ATTENTION: /** @type {const} */ ('requer_atencao'),
  HIGH: /** @type {const} */ ('alto_risco'),
  INCONCLUSIVE: /** @type {const} */ ('analise_inconclusiva'),
})

/** Ordem de exibição em filtros e legendas. */
export const STATUS_CODES = /** @type {StatusCode[]} */ ([STATUS.LOW, STATUS.ATTENTION, STATUS.HIGH, STATUS.INCONCLUSIVE])

/**
 * RF16: 0 a 25, acima de 25 até 60 e acima de 60 até 100.
 * A API aplica as mesmas faixas (rules-v1.0.0); a interface só as usa para desenhar a escala.
 */
export const RISK_BANDS = Object.freeze({ lowMax: 25, attentionMax: 60, max: 100 })

/**
 * @typedef {{
 *   code: StatusCode,
 *   tone: Tone,
 *   label: string,
 *   shortLabel: string,
 *   summary: string,
 *   nextStepTitle: string,
 * }} StatusInfo
 */

/** @type {Readonly<Record<StatusCode, StatusInfo>>} */
export const STATUS_INFO = Object.freeze({
  [STATUS.LOW]: {
    code: STATUS.LOW,
    tone: 'low',
    label: 'Poucos sinais de risco',
    shortLabel: 'Pouco risco',
    summary: 'Menos sinais de alerta. Confira a fonte antes de assumir que tudo está comprovado.',
    nextStepTitle: 'Confira a origem.',
  },
  [STATUS.ATTENTION]: {
    code: STATUS.ATTENTION,
    tone: 'attention',
    label: 'Requer atenção',
    shortLabel: 'Atenção',
    summary: 'Há pontos a esclarecer. Uma pausa e mais contexto ajudam a decidir.',
    nextStepTitle: 'Pause antes de repassar.',
  },
  [STATUS.HIGH]: {
    code: STATUS.HIGH,
    tone: 'high',
    label: 'Alto risco',
    shortLabel: 'Alto risco',
    summary: 'Indícios fortes de risco. Evite repassar e procure referências verificáveis.',
    nextStepTitle: 'Pause antes de repassar.',
  },
  [STATUS.INCONCLUSIVE]: {
    code: STATUS.INCONCLUSIVE,
    tone: 'inconclusive',
    label: 'Análise inconclusiva',
    shortLabel: 'Inconclusivo',
    summary: 'Não há informação suficiente. A ausência de evidência não comprova falsidade.',
    nextStepTitle: 'Busque mais contexto.',
  },
})

/**
 * @param {unknown} value
 * @returns {value is StatusCode}
 */
export function isStatusCode(value) {
  return typeof value === 'string' && Object.hasOwn(STATUS_INFO, value)
}

/**
 * Faixa do índice, sem lacunas nos limites (RF16): 25 ainda é "poucos sinais" e 60 ainda é
 * "requer atenção"; 25,01 e 60,01 já pertencem à faixa seguinte.
 * @param {number} index
 * @returns {Exclude<StatusCode, 'analise_inconclusiva'> | null}
 */
export function bandForIndex(index) {
  if (typeof index !== 'number' || !Number.isFinite(index) || index < 0 || index > RISK_BANDS.max) return null
  if (index <= RISK_BANDS.lowMax) return STATUS.LOW
  if (index <= RISK_BANDS.attentionMax) return STATUS.ATTENTION
  return STATUS.HIGH
}

/**
 * Status que a interface deve mostrar. RF16: o status inconclusivo tem prioridade quando
 * qualquer condição do RF14 ocorre. A API já decide isso; esta checagem impede que um
 * resultado com motivo de abstenção (ou sem índice) apareça como baixo, médio ou alto risco.
 * @param {{ status: { code: StatusCode }, riskIndex: number | null, abstention: unknown[] }} analysis
 * @returns {StatusCode}
 */
export function effectiveStatusCode(analysis) {
  if (analysis.status.code === STATUS.INCONCLUSIVE) return STATUS.INCONCLUSIVE
  if (analysis.abstention.length > 0 || analysis.riskIndex === null) return STATUS.INCONCLUSIVE
  return analysis.status.code
}
