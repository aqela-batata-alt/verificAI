import { describe, expect, it, vi } from 'vitest'
import { VISITOR_LIMIT } from '../domain/limits.js'
import { createDemoAuthGateway, createDemoFeedbackGateway } from './gateways.js'
import { createHistoryStore } from './historyStore.js'
import { STORAGE_KEYS, createStorage } from './storage.js'
import { createVisitorLimitStore } from './visitorLimitStore.js'

const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 9, 8, 12, 0, 0)

const entry = (n, patch = {}) => ({
  id: `id-${n}`,
  claim: `Alegação ${n}`,
  status: 'requer_atencao',
  createdAt: new Date(T0 + n * 60_000).toISOString(),
  inputType: 'text',
  ...patch,
})

describe('contador do visitante guardado no navegador (RF33, RNF19)', () => {
  it('conta só o que chama registerCounted e persiste entre recarregamentos', () => {
    const storage = createStorage()
    let clock = T0
    const a = createVisitorLimitStore({ storage, now: () => clock })
    expect(a.remaining()).toBe(3)
    a.registerCounted()
    clock += HOUR
    a.registerCounted()
    // "Fecha e reabre o navegador": novo store sobre o mesmo armazenamento.
    const b = createVisitorLimitStore({ storage, now: () => clock })
    expect(b.remaining()).toBe(1)
    expect(b.renewsAt()).toBe(T0 + VISITOR_LIMIT.windowMs)
  })

  it('a quarta tentativa na janela é barrada e a janela expira em 24 h', () => {
    const storage = createStorage()
    let clock = T0
    const store = createVisitorLimitStore({ storage, now: () => clock })
    for (let i = 0; i < 3; i += 1) {
      expect(store.canStart()).toBe(true)
      store.registerCounted()
    }
    expect(store.canStart()).toBe(false)
    clock = T0 + VISITOR_LIMIT.windowMs
    expect(store.canStart()).toBe(true)
    expect(store.remaining()).toBe(3)
  })

  it('guarda só contagem e início da janela, nunca texto', () => {
    const storage = createStorage()
    createVisitorLimitStore({ storage, now: () => T0 }).registerCounted()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.visitorLimit))).toEqual({ windowStart: T0, count: 1 })
  })

  it('duas abas enxergam o mesmo contador e a assinatura é avisada', () => {
    const storage = createStorage()
    const tab1 = createVisitorLimitStore({ storage, now: () => T0 })
    const tab2 = createVisitorLimitStore({ storage, now: () => T0 })
    const listener = vi.fn()
    tab2.subscribe(listener)
    tab1.registerCounted()
    expect(tab2.remaining()).toBe(2)
    expect(listener).toHaveBeenCalled()
  })

  it('dado corrompido no armazenamento não trava o visitante', () => {
    localStorage.setItem(STORAGE_KEYS.visitorLimit, '{"count": 99, "windowStart": "x"}')
    expect(createVisitorLimitStore({ storage: createStorage(), now: () => T0 }).remaining()).toBe(3)
    localStorage.setItem(STORAGE_KEYS.visitorLimit, 'não é json')
    expect(createVisitorLimitStore({ storage: createStorage(), now: () => T0 }).remaining()).toBe(3)
  })

  it('o snapshot é estável enquanto nada muda (necessário para useSyncExternalStore)', () => {
    const store = createVisitorLimitStore({ storage: createStorage(), now: () => T0 })
    expect(store.getSnapshot()).toBe(store.getSnapshot())
    store.registerCounted()
    const after = store.getSnapshot()
    expect(store.getSnapshot()).toBe(after)
  })
})

describe('histórico local (RF20, RF28)', () => {
  it('guarda, ordena do mais novo para o mais antigo e persiste', () => {
    const storage = createStorage()
    const store = createHistoryStore({ storage })
    store.add(entry(1))
    store.add(entry(2))
    const reopened = createHistoryStore({ storage })
    expect(reopened.getSnapshot().items.map((i) => i.id)).toEqual(['id-2', 'id-1'])
  })

  it('RF20: o item excluído some na hora e o histórico não guarda texto integral', () => {
    const store = createHistoryStore({ storage: createStorage() })
    store.add({ ...entry(1), fullText: 'texto integral' })
    store.add(entry(2))
    const removed = store.remove('id-1')
    expect(removed?.item.id).toBe('id-1')
    expect(store.getSnapshot().items.map((i) => i.id)).toEqual(['id-2'])
    expect(localStorage.getItem(STORAGE_KEYS.history)).not.toMatch(/texto integral/)
  })

  it('desfazer devolve o item à posição de origem', () => {
    const store = createHistoryStore({ storage: createStorage() })
    for (const n of [1, 2, 3]) store.add(entry(n)) // ordem: 3, 2, 1
    const removed = store.remove('id-2')
    expect(store.getSnapshot().items.map((i) => i.id)).toEqual(['id-3', 'id-1'])
    store.restore(removed.item, removed.index)
    expect(store.getSnapshot().items.map((i) => i.id)).toEqual(['id-3', 'id-2', 'id-1'])
    // Restaurar duas vezes não duplica.
    store.restore(removed.item, removed.index)
    expect(store.getSnapshot().items).toHaveLength(3)
  })

  it('remover um item que não existe não muda nada', () => {
    const store = createHistoryStore({ storage: createStorage() })
    store.add(entry(1))
    expect(store.remove('nao-existe')).toBeNull()
    expect(store.getSnapshot().items).toHaveLength(1)
  })

  it('limpar remove todos os registros locais', () => {
    const store = createHistoryStore({ storage: createStorage() })
    store.add(entry(1))
    store.add(entry(2))
    store.clear()
    expect(store.getSnapshot().items).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.history))).toEqual([])
  })

  it('RF20: o histórico é opcional. Desligado, novas análises não são guardadas', () => {
    const store = createHistoryStore({ storage: createStorage() })
    expect(store.getSnapshot().enabled).toBe(true)
    store.add(entry(1))
    store.setEnabled(false)
    expect(store.getSnapshot().enabled).toBe(false)
    expect(store.add(entry(2))).toBe(false)
    expect(store.getSnapshot().items.map((i) => i.id)).toEqual(['id-1'])
    store.setEnabled(true)
    expect(store.add(entry(3))).toBe(true)
  })

  it('itens corrompidos no armazenamento são ignorados', () => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify([entry(1), { id: 'x' }, 'lixo']))
    const store = createHistoryStore({ storage: createStorage() })
    expect(store.getSnapshot().items.map((i) => i.id)).toEqual(['id-1'])
    localStorage.setItem(STORAGE_KEYS.history, 'não é json')
    expect(createHistoryStore({ storage: createStorage() }).getSnapshot().items).toEqual([])
  })

  it('o snapshot é estável enquanto nada muda', () => {
    const store = createHistoryStore({ storage: createStorage() })
    store.add(entry(1))
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })

  it('sem armazenamento persistente, informa isso para a tela avisar o usuário', () => {
    const store = createHistoryStore({ storage: createStorage({ backend: null }) })
    expect(store.getSnapshot().persistent).toBe(false)
    store.add(entry(1))
    expect(store.getSnapshot().items).toHaveLength(1)
  })
})

describe('contas em modo demonstração (RF28, RF31, RF34)', () => {
  it('entrar não guarda e-mail nem senha, só "entrou"', async () => {
    const storage = createStorage()
    const auth = createDemoAuthGateway({ storage })
    await auth.signIn({ email: 'pessoa@exemplo.com', password: 'senha-super-secreta' })
    const saved = localStorage.getItem(STORAGE_KEYS.demoSession)
    expect(JSON.parse(saved)).toEqual({ signedIn: true, historyLinked: false })
    expect(saved).not.toMatch(/pessoa|exemplo|senha/)
    expect(auth.getSession()).toEqual({ signedIn: true, historyLinked: false })
  })

  it('RF28: entrar NÃO vincula o histórico local; só a confirmação explícita vincula', async () => {
    const storage = createStorage()
    const history = createHistoryStore({ storage })
    history.add(entry(1))
    const auth = createDemoAuthGateway({ storage })
    await auth.signIn({ email: 'a@b.co', password: '12345678' })
    expect(auth.getSession().historyLinked).toBe(false)
    await auth.linkHistory(true)
    expect(auth.getSession().historyLinked).toBe(true)
    await auth.linkHistory(false)
    expect(auth.getSession().historyLinked).toBe(false)
  })

  it('sair encerra a sessão e mantém o histórico local', async () => {
    const storage = createStorage()
    const history = createHistoryStore({ storage })
    history.add(entry(1))
    const auth = createDemoAuthGateway({ storage })
    await auth.signUp({ email: 'a@b.co', password: '12345678' })
    await auth.signOut()
    expect(auth.getSession().signedIn).toBe(false)
    expect(history.getSnapshot().items).toHaveLength(1)
  })

  it('vincular sem estar logado não faz nada', async () => {
    const auth = createDemoAuthGateway({ storage: createStorage() })
    await auth.linkHistory(true)
    expect(auth.getSession()).toEqual({ signedIn: false, historyLinked: false })
  })

  it('notifica quem assina quando a sessão muda', async () => {
    const auth = createDemoAuthGateway({ storage: createStorage() })
    const listener = vi.fn()
    auth.subscribe(listener)
    await auth.signIn({ email: 'a@b.co', password: '12345678' })
    await auth.signOut()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('sessão estável entre leituras e corrompida vira "não entrou"', () => {
    const auth = createDemoAuthGateway({ storage: createStorage() })
    expect(auth.getSnapshot()).toBe(auth.getSnapshot())
    localStorage.setItem(STORAGE_KEYS.demoSession, 'lixo')
    expect(createDemoAuthGateway({ storage: createStorage() }).getSession().signedIn).toBe(false)
  })

  it('o gateway de demonstração se declara como demonstração', () => {
    expect(createDemoAuthGateway({ storage: createStorage() }).mode).toBe('demo')
    expect(createDemoFeedbackGateway().mode).toBe('demo')
  })

  it('o feedback de demonstração não grava nada e diz que não foi entregue', async () => {
    const before = JSON.stringify({ ...localStorage })
    const result = await createDemoFeedbackGateway().submit({ analysisId: 'x', useful: true, comment: 'ótimo' })
    expect(result).toEqual({ delivered: false })
    expect(JSON.stringify({ ...localStorage })).toBe(before)
  })
})
