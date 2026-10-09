// @ts-check
// Histórico (RF20, RF28): cada item guarda só alegação resumida, status, data e identificador
// da análise. O texto integral nunca entra no histórico.

import { statusOf } from './analysis.js'
import { HISTORY_MAX_ITEMS } from './limits.js'
import { isStatusCode } from './status.js'

/**
 * @typedef {{
 *   id: string,
 *   claim: string,
 *   status: import('./status.js').StatusCode,
 *   createdAt: string,
 *   inputType: 'text' | 'url',
 * }} HistoryItem
 */

/**
 * @param {import('./analysis.js').Analysis} analysis
 * @returns {HistoryItem}
 */
export function toHistoryItem(analysis) {
  return {
    id: analysis.id,
    claim: analysis.claim.summary,
    status: statusOf(analysis),
    createdAt: analysis.createdAt,
    inputType: analysis.inputType,
  }
}

/**
 * Lê itens guardados, ignorando os que estão fora do formato (armazenamento é dado não confiável).
 * @param {unknown} raw
 * @returns {HistoryItem[]}
 */
export function parseHistoryItems(raw) {
  if (!Array.isArray(raw)) return []
  /** @type {HistoryItem[]} */
  const items = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, claim, status, createdAt, inputType } = /** @type {Record<string, unknown>} */ (entry)
    if (typeof id !== 'string' || !id) continue
    if (typeof claim !== 'string') continue
    if (!isStatusCode(status)) continue
    if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) continue
    items.push({ id, claim, status, createdAt, inputType: inputType === 'url' ? 'url' : 'text' })
  }
  return items.slice(0, HISTORY_MAX_ITEMS)
}

/**
 * Coloca o item no topo, sem duplicar o mesmo identificador, respeitando o teto.
 * @param {HistoryItem[]} items
 * @param {HistoryItem} item
 * @returns {HistoryItem[]}
 */
export function addHistoryItem(items, item) {
  return [item, ...items.filter((existing) => existing.id !== item.id)].slice(0, HISTORY_MAX_ITEMS)
}

/**
 * @param {string} value
 */
const fold = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Filtro por status e busca por palavra (sem diferenciar maiúsculas nem acentos).
 * @param {HistoryItem[]} items
 * @param {{ status?: 'all' | import('./status.js').StatusCode, query?: string }} filters
 * @returns {HistoryItem[]}
 */
export function filterHistory(items, { status = 'all', query = '' } = {}) {
  const needle = fold(query.trim())
  return items.filter(
    (item) => (status === 'all' || item.status === status) && (!needle || fold(item.claim).includes(needle)),
  )
}
