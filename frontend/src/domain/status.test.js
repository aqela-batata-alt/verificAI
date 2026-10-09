import { describe, expect, it } from 'vitest'
import { STATUS, STATUS_CODES, STATUS_INFO, bandForIndex, effectiveStatusCode, isStatusCode } from './status.js'

describe('bandForIndex (RF16: faixas 0–25, >25–60 e >60–100, sem lacunas)', () => {
  it.each([
    [0, STATUS.LOW],
    [24.99, STATUS.LOW],
    [25, STATUS.LOW],
    [25.01, STATUS.ATTENTION],
    [25.0000001, STATUS.ATTENTION],
    [42, STATUS.ATTENTION],
    [60, STATUS.ATTENTION],
    [60.01, STATUS.HIGH],
    [88.1, STATUS.HIGH],
    [100, STATUS.HIGH],
  ])('índice %s → %s', (index, expected) => {
    expect(bandForIndex(index)).toBe(expected)
  })

  it.each([-1, 100.01, Number.NaN, Infinity, null, undefined, '50'])('devolve null para %s', (value) => {
    expect(bandForIndex(/** @type {any} */ (value))).toBeNull()
  })
})

describe('effectiveStatusCode (RF16: inconclusivo tem prioridade)', () => {
  const base = { status: { code: STATUS.ATTENTION }, riskIndex: 48, abstention: [] }

  it('mantém o status da API quando não há motivo de abstenção', () => {
    expect(effectiveStatusCode(base)).toBe(STATUS.ATTENTION)
  })

  it('o status inconclusivo da API vale sempre', () => {
    expect(effectiveStatusCode({ ...base, status: { code: STATUS.INCONCLUSIVE }, riskIndex: null })).toBe(STATUS.INCONCLUSIVE)
  })

  it('motivo de abstenção vence um status de risco (nunca mostra alto risco com abstenção)', () => {
    const withReason = { ...base, status: { code: STATUS.HIGH }, abstention: [{ code: 'low_confidence' }] }
    expect(effectiveStatusCode(withReason)).toBe(STATUS.INCONCLUSIVE)
  })

  it('sem índice de risco não há classificação de risco', () => {
    expect(effectiveStatusCode({ ...base, riskIndex: null })).toBe(STATUS.INCONCLUSIVE)
  })
})

describe('catálogo de status', () => {
  it('tem os quatro status do RF16 em linguagem simples', () => {
    expect(STATUS_CODES).toHaveLength(4)
    expect(STATUS_CODES.map((c) => STATUS_INFO[c].label)).toEqual([
      'Poucos sinais de risco',
      'Requer atenção',
      'Alto risco',
      'Análise inconclusiva',
    ])
  })

  it('não chama o índice de certeza nem de probabilidade de falsidade em nenhum texto', () => {
    const all = JSON.stringify(STATUS_INFO).toLowerCase()
    expect(all).not.toMatch(/certeza de que|probabilidade de ser falsa|verdadeiro|100% falso/)
  })

  it('isStatusCode só aceita os códigos conhecidos', () => {
    expect(isStatusCode('alto_risco')).toBe(true)
    expect(isStatusCode('falsa')).toBe(false)
    expect(isStatusCode(undefined)).toBe(false)
    expect(isStatusCode('toString')).toBe(false)
  })
})
