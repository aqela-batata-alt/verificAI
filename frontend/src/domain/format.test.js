import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateParts,
  formatDateTime,
  formatDecimal,
  formatFraction,
  formatIndex,
  formatNumber,
  formatPercent,
  formatRemaining,
  formatRenewal,
  formatSeconds,
} from './format.js'

describe('formatação em português do Brasil', () => {
  it('data e hora no fuso de Brasília', () => {
    expect(formatDateTime('2026-10-08T11:53:00Z')).toBe('08/10/2026 08:53')
  })

  it('data inválida não quebra a tela', () => {
    expect(formatDateTime('nunca')).toBe('data não informada')
    expect(formatDateParts('nunca')).toEqual({ date: '—', time: '' })
    expect(formatRenewal('nunca')).toBe('')
  })

  it('renovação do limite: dia/mês às hora:minuto', () => {
    expect(formatRenewal('2026-10-09T17:35:00Z')).toBe('09/10 às 14:35')
  })

  it('tempo restante em linguagem simples, arredondando para cima', () => {
    expect(formatRemaining(0)).toBe('menos de 1 min')
    expect(formatRemaining(30_000)).toBe('1 min')
    expect(formatRemaining(45 * 60_000)).toBe('45 min')
    expect(formatRemaining(60 * 60_000)).toBe('1 h')
    expect(formatRemaining((3 * 60 + 12) * 60_000)).toBe('3 h 12 min')
    expect(formatRemaining(-5)).toBe('menos de 1 min')
  })

  it('números com separador do português', () => {
    expect(formatNumber(5000)).toBe('5.000')
    expect(formatDecimal(48.31)).toBe('48,3')
    expect(formatDecimal(60)).toBe('60')
  })
})

describe('formatIndex (índice de risco, RF16)', () => {
  it('mantém até duas casas para o valor não contradizer a faixa', () => {
    expect(formatIndex(48.31)).toBe('48,31')
    expect(formatIndex(25.04)).toBe('25,04')
    expect(formatIndex(25)).toBe('25')
    expect(formatIndex(60.01)).toBe('60,01')
    expect(formatIndex(100)).toBe('100')
  })
})

describe('formatos usados no resultado', () => {
  it('data de publicação sem hora', () => {
    expect(formatDate('2026-10-08T11:53:00Z')).toMatch(/^0[78]\/10\/2026$/)
    expect(formatDate('não é data')).toBe('data não informada')
  })

  it('proporção como porcentagem em português', () => {
    expect(formatPercent(0.08)).toBe('8%')
    expect(formatPercent(0.004)).toBe('0,4%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('duração em segundos com uma casa', () => {
    expect(formatSeconds(1204.7)).toBe('1,2 s')
    expect(formatSeconds(812.4)).toBe('0,8 s')
  })
})

describe('formatFraction (pontuações e pesos de 0 a 1, área técnica)', () => {
  it('mostra até duas casas, para o peso 0,15 não virar 0,2', () => {
    expect(formatFraction(0.15)).toBe('0,15')
    expect(formatFraction(0.25)).toBe('0,25')
    expect(formatFraction(0.6)).toBe('0,6')
    expect(formatFraction(0.62)).toBe('0,62')
    expect(formatFraction(0.8123)).toBe('0,81')
    expect(formatFraction(0)).toBe('0')
    expect(formatFraction(1)).toBe('1')
  })
})
