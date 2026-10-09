import { describe, expect, it } from 'vitest'
import { VISITOR_LIMIT } from './limits.js'
import { EMPTY_LIMIT_STATE, canStart, parseLimitState, refresh, registerCounted, remaining, renewsAt } from './visitorLimit.js'

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0)
const HOUR = 60 * 60 * 1000

describe('limite de visitante (RF33)', () => {
  it('começa com três análises disponíveis e sem janela aberta', () => {
    expect(remaining(EMPTY_LIMIT_STATE, T0)).toBe(3)
    expect(canStart(EMPTY_LIMIT_STATE, T0)).toBe(true)
    expect(renewsAt(EMPTY_LIMIT_STATE, T0)).toBeNull()
  })

  it('permite as três primeiras análises e bloqueia a quarta dentro da janela', () => {
    let state = EMPTY_LIMIT_STATE
    for (let i = 1; i <= 3; i += 1) {
      expect(canStart(state, T0 + i * HOUR)).toBe(true)
      state = registerCounted(state, T0 + i * HOUR)
    }
    expect(remaining(state, T0 + 4 * HOUR)).toBe(0)
    expect(canStart(state, T0 + 4 * HOUR)).toBe(false)
  })

  it('a janela de 24 h começa na primeira análise contabilizada, não nas seguintes', () => {
    let state = registerCounted(EMPTY_LIMIT_STATE, T0)
    state = registerCounted(state, T0 + 10 * HOUR)
    state = registerCounted(state, T0 + 20 * HOUR)
    expect(state.windowStart).toBe(T0)
    expect(renewsAt(state, T0 + 21 * HOUR)).toBe(T0 + VISITOR_LIMIT.windowMs)
  })

  it('reinicia o contador exatamente 24 h depois da primeira análise contabilizada', () => {
    let state = EMPTY_LIMIT_STATE
    for (let i = 0; i < 3; i += 1) state = registerCounted(state, T0 + i * HOUR)
    expect(canStart(state, T0 + 24 * HOUR - 1)).toBe(false) // 1 ms antes
    expect(canStart(state, T0 + 24 * HOUR)).toBe(true) // no instante
    expect(remaining(state, T0 + 24 * HOUR)).toBe(3)
    expect(refresh(state, T0 + 24 * HOUR)).toEqual(EMPTY_LIMIT_STATE)
  })

  it('após a renovação, a próxima análise abre uma janela nova', () => {
    let state = EMPTY_LIMIT_STATE
    for (let i = 0; i < 3; i += 1) state = registerCounted(state, T0 + i * HOUR)
    const later = T0 + 30 * HOUR
    state = registerCounted(state, later)
    expect(state).toEqual({ windowStart: later, count: 1 })
    expect(remaining(state, later)).toBe(2)
  })

  it('não altera o estado recebido (função pura)', () => {
    const before = Object.freeze({ windowStart: T0, count: 1 })
    registerCounted(before, T0 + HOUR)
    expect(before).toEqual({ windowStart: T0, count: 1 })
  })

  it('se o relógio do aparelho voltou muito no tempo, descarta a janela em vez de travar o visitante', () => {
    const state = { windowStart: T0 + 5 * HOUR, count: 3 }
    expect(canStart(state, T0)).toBe(true)
  })
})

describe('parseLimitState (o armazenamento é dado não confiável)', () => {
  it.each([null, undefined, 'x', 3, [], {}, { count: 'a' }, { count: -1, windowStart: T0 }, { count: 1.5, windowStart: T0 }, { count: 2 }, { count: 2, windowStart: 'ontem' }, { count: 1, windowStart: Number.NaN }])(
    'volta ao zero para %j',
    (raw) => {
      expect(parseLimitState(raw)).toEqual(EMPTY_LIMIT_STATE)
    },
  )

  it('aceita um estado válido', () => {
    expect(parseLimitState({ windowStart: T0, count: 2 })).toEqual({ windowStart: T0, count: 2 })
  })

  it('o estado guardado só tem contagem e início: nada de texto nem dado pessoal (RNF19)', () => {
    const state = registerCounted(EMPTY_LIMIT_STATE, T0)
    expect(Object.keys(state).sort()).toEqual(['count', 'windowStart'])
  })
})
