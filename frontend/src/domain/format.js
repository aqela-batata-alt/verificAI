// @ts-check
// Formatação de datas e prazos em português do Brasil.

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const timeOnly = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

/** @param {string | number | Date} value */
const toDate = (value) => (value instanceof Date ? value : new Date(value))

/**
 * "08/10/2026 08:53"
 * @param {string | number | Date} value
 */
export function formatDateTime(value) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return 'data não informada'
  return dateTime.format(date).replace(',', '')
}

/**
 * Data curta e hora em duas partes, para linhas de histórico: { date: "08 out.", time: "08:53" }.
 * @param {string | number | Date} value
 */
export function formatDateParts(value) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return { date: '—', time: '' }
  return { date: dateOnly.format(date), time: timeOnly.format(date) }
}

/**
 * "09/10 às 14:35"
 * @param {string | number | Date} value
 */
export function formatRenewal(value) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${dayMonth.format(date)} às ${timeOnly.format(date)}`
}

/**
 * Tempo restante em linguagem simples: "3 h 12 min", "45 min", "menos de 1 min".
 * @param {number} ms
 */
export function formatRemaining(ms) {
  const totalMinutes = Math.ceil(Math.max(0, ms) / 60_000)
  if (totalMinutes < 1) return 'menos de 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

const numberFormat = new Intl.NumberFormat('pt-BR')
/** @param {number} value */
export const formatNumber = (value) => numberFormat.format(value)

const decimalFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
/** @param {number} value */
export const formatDecimal = (value) => decimalFormat.format(value)

// O índice de risco usa até duas casas, como a API devolve. Com uma casa só, 25,04 apareceria
// como "25" dentro da faixa "acima de 25" e pareceria um erro (RF16: limites sem lacunas).
const indexFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
/** @param {number} value */
export const formatIndex = (value) => indexFormat.format(value)

// Pontuações e pesos entre 0 e 1 (área técnica, RF21) usam até duas casas. Com uma casa só, o peso
// 0,15 apareceria como "0,2" e o 0,25 como "0,3": a área que serve para reproduzir o cálculo mostraria
// pesos diferentes dos que a API usa.
const fractionFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
/**
 * "0,15" a partir de 0,15.
 * @param {number} value
 */
export const formatFraction = (value) => fractionFormat.format(value)

const dateLong = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
/**
 * "08/10/2026". Para datas de publicação de fontes.
 * @param {string | number | Date} value
 */
export function formatDate(value) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return 'data não informada'
  return dateLong.format(date)
}

const percentFormat = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
/**
 * "8%" a partir de 0,08.
 * @param {number} ratio
 */
export const formatPercent = (ratio) => percentFormat.format(ratio)

/**
 * "1,2 s" a partir de milissegundos.
 * @param {number} ms
 */
export const formatSeconds = (ms) => `${formatDecimal(Math.round(ms / 100) / 10)} s`
