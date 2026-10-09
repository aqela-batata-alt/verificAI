// @ts-check
// Acesso seguro ao armazenamento do navegador.
//
// O localStorage pode lançar exceção ou vir vazio (janela privada, dados do site bloqueados,
// cota cheia). Toda leitura e escrita passa por aqui, dentro de try/catch, e a interface
// continua funcionando sem ele. Nada guardado aqui é segredo: o armazenamento do navegador é
// legível por qualquer script da própria página.

/** Chaves usadas pela aplicação, todas com o prefixo "apura:". */
export const STORAGE_KEYS = Object.freeze({
  visitorId: 'apura:visitor-id',
  visitorLimit: 'apura:visitor-limit',
  history: 'apura:history:v1',
  historyEnabled: 'apura:history-enabled',
  demoSession: 'apura:demo-session',
})

/**
 * @typedef {{
 *   available: boolean,
 *   getJSON: (key: string) => unknown,
 *   setJSON: (key: string, value: unknown) => boolean,
 *   getString: (key: string) => string | null,
 *   setString: (key: string, value: string) => boolean,
 *   remove: (key: string) => void,
 *   subscribe: (key: string, listener: () => void) => () => void,
 * }} AppStorage
 */

/** @returns {Storage | null} */
function browserStorage() {
  try {
    const storage = window.localStorage
    const probe = '__apura_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

/**
 * @param {{ backend?: Storage | null }} [options] "backend: null" força o modo só-memória (testes)
 * @returns {AppStorage}
 */
export function createStorage({ backend } = {}) {
  const store = backend === undefined ? browserStorage() : backend
  /** @type {Map<string, string>} */
  const memory = new Map()
  /** @type {Map<string, Set<() => void>>} */
  const listeners = new Map()

  /** @param {string} key */
  const notify = (key) => listeners.get(key)?.forEach((listener) => listener())

  /** @param {string} key @returns {string | null} */
  const getString = (key) => {
    if (store) {
      try {
        return store.getItem(key)
      } catch {
        return memory.get(key) ?? null
      }
    }
    return memory.get(key) ?? null
  }

  /** @param {string} key @param {string} value */
  const setString = (key, value) => {
    let persisted = false
    if (store) {
      try {
        store.setItem(key, value)
        persisted = true
      } catch {
        persisted = false
      }
    }
    if (!persisted) memory.set(key, value)
    notify(key)
    return persisted
  }

  return {
    available: Boolean(store),
    getString,
    setString,
    getJSON(key) {
      const raw = getString(key)
      if (raw === null) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },
    setJSON(key, value) {
      return setString(key, JSON.stringify(value))
    },
    remove(key) {
      memory.delete(key)
      try {
        store?.removeItem(key)
      } catch {
        /* sem armazenamento: nada a remover */
      }
      notify(key)
    },
    subscribe(key, listener) {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(listener)
      // Outra aba do mesmo navegador mudou o valor (ex.: gastou uma análise do limite).
      /** @param {StorageEvent} event */
      const onStorage = (event) => {
        if (event.key === key || event.key === null) listener()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        set.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },
  }
}
