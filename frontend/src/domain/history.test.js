import { describe, expect, it } from 'vitest'
import { apiInconclusive, makeApiAnalysis } from '../test/fixtures.js'
import { normalizeAnalysis } from './analysis.js'
import { addHistoryItem, filterHistory, parseHistoryItems, toHistoryItem } from './history.js'
import { HISTORY_MAX_ITEMS } from './limits.js'

const item = (n, patch = {}) => ({
  id: `id-${n}`,
  claim: `Alegação ${n}`,
  status: 'requer_atencao',
  createdAt: new Date(Date.UTC(2026, 9, 8, 12, n)).toISOString(),
  inputType: 'text',
  ...patch,
})

describe('toHistoryItem (RF20: só alegação resumida, status, data e identificador)', () => {
  it('guarda exatamente os campos previstos e nenhum texto integral', () => {
    const analysis = normalizeAnalysis(makeApiAnalysis())
    const entry = toHistoryItem(analysis)
    expect(Object.keys(entry).sort()).toEqual(['claim', 'createdAt', 'id', 'inputType', 'status'])
    expect(entry).toEqual({
      id: analysis.id,
      claim: analysis.claim.summary,
      status: 'requer_atencao',
      createdAt: analysis.createdAt,
      inputType: 'text',
    })
  })

  it('o status guardado respeita a prioridade do inconclusivo (RF16)', () => {
    const entry = toHistoryItem(normalizeAnalysis(apiInconclusive()))
    expect(entry.status).toBe('analise_inconclusiva')
  })
})

describe('parseHistoryItems (armazenamento é dado não confiável)', () => {
  it('ignora entradas fora do formato e mantém as válidas', () => {
    const parsed = parseHistoryItems([
      item(1),
      null,
      'texto',
      { id: '', claim: 'x', status: 'alto_risco', createdAt: item(1).createdAt },
      { id: 'a', claim: 3, status: 'alto_risco', createdAt: item(1).createdAt },
      { id: 'b', claim: 'x', status: 'verdadeira', createdAt: item(1).createdAt },
      { id: 'c', claim: 'x', status: 'alto_risco', createdAt: 'nunca' },
      item(2, { inputType: 'banana' }),
    ])
    expect(parsed.map((i) => i.id)).toEqual(['id-1', 'id-2'])
    expect(parsed[1].inputType).toBe('text')
  })

  it('devolve lista vazia para qualquer coisa que não seja lista', () => {
    for (const raw of [null, undefined, {}, 'x', 3]) expect(parseHistoryItems(raw)).toEqual([])
  })

  it('não carrega campos extras que alguém tenha gravado (ex.: texto integral)', () => {
    const [parsed] = parseHistoryItems([{ ...item(1), fullText: 'texto integral secreto' }])
    expect(parsed).not.toHaveProperty('fullText')
  })
})

describe('addHistoryItem', () => {
  it('põe o item mais novo no topo e não duplica o identificador', () => {
    const list = addHistoryItem([item(1), item(2)], item(2, { claim: 'atualizada' }))
    expect(list.map((i) => i.id)).toEqual(['id-2', 'id-1'])
    expect(list[0].claim).toBe('atualizada')
  })

  it(`respeita o teto técnico de ${HISTORY_MAX_ITEMS} itens, descartando os mais antigos`, () => {
    let list = []
    for (let n = 0; n < HISTORY_MAX_ITEMS + 5; n += 1) list = addHistoryItem(list, item(n))
    expect(list).toHaveLength(HISTORY_MAX_ITEMS)
    expect(list[0].id).toBe(`id-${HISTORY_MAX_ITEMS + 4}`)
    expect(list.at(-1).id).toBe('id-5')
  })
})

describe('filterHistory', () => {
  const items = [
    item(1, { claim: 'Ônibus param no domingo', status: 'requer_atencao' }),
    item(2, { claim: 'Biblioteca anuncia leitura', status: 'poucos_sinais_de_risco' }),
    item(3, { claim: 'Auxílio de R$ 5.000 amanhã', status: 'alto_risco' }),
    item(4, { claim: 'Praça será fechada', status: 'analise_inconclusiva' }),
  ]

  it('sem filtros devolve tudo', () => {
    expect(filterHistory(items)).toHaveLength(4)
    expect(filterHistory(items, { status: 'all', query: '' })).toHaveLength(4)
  })

  it('filtra por status', () => {
    expect(filterHistory(items, { status: 'alto_risco' }).map((i) => i.id)).toEqual(['id-3'])
  })

  it('busca por palavra sem diferenciar maiúsculas nem acentos', () => {
    expect(filterHistory(items, { query: 'onibus' }).map((i) => i.id)).toEqual(['id-1'])
    expect(filterHistory(items, { query: 'PRAÇA' }).map((i) => i.id)).toEqual(['id-4'])
    expect(filterHistory(items, { query: 'auxilio' }).map((i) => i.id)).toEqual(['id-3'])
  })

  it('combina status e busca', () => {
    expect(filterHistory(items, { status: 'requer_atencao', query: 'biblioteca' })).toEqual([])
  })
})
