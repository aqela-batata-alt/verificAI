// @ts-check
// Histórico local do visitante (RF20, RF28): fica só neste navegador.
// Cada item tem alegação resumida, status, data e identificador; nunca o texto integral.

import { addHistoryItem, parseHistoryItems } from '../domain/history.js'
import { STORAGE_KEYS } from './storage.js'

/**
 * @typedef {{
 *   items: import('../domain/history.js').HistoryItem[],
 *   enabled: boolean,
 *   persistent: boolean,
 * }} HistorySnapshot
 */

/**
 * @param {{ storage: import('./storage.js').AppStorage }} deps
 */
export function createHistoryStore({ storage }) {
  /** @type {string | null | undefined} */
  let lastItemsRaw
  /** @type {string | null | undefined} */
  let lastEnabledRaw
  /** @type {HistorySnapshot} */
  let snapshot = { items: [], enabled: true, persistent: storage.available }

  function getSnapshot() {
    const itemsRaw = storage.getString(STORAGE_KEYS.history)
    const enabledRaw = storage.getString(STORAGE_KEYS.historyEnabled)
    if (itemsRaw !== lastItemsRaw || enabledRaw !== lastEnabledRaw) {
      lastItemsRaw = itemsRaw
      lastEnabledRaw = enabledRaw
      let parsed = null
      try {
        parsed = itemsRaw === null ? null : JSON.parse(itemsRaw)
      } catch {
        parsed = null
      }
      snapshot = {
        items: parseHistoryItems(parsed),
        // Padrão: ligado. O usuário pode desligar (RF20: histórico opcional).
        enabled: enabledRaw !== 'false',
        persistent: storage.available,
      }
    }
    return snapshot
  }

  /** @param {import('../domain/history.js').HistoryItem[]} items */
  const write = (items) => storage.setJSON(STORAGE_KEYS.history, items)

  return {
    /** @param {() => void} listener */
    subscribe(listener) {
      const offItems = storage.subscribe(STORAGE_KEYS.history, listener)
      const offEnabled = storage.subscribe(STORAGE_KEYS.historyEnabled, listener)
      return () => {
        offItems()
        offEnabled()
      }
    },
    getSnapshot,

    /**
     * Guarda uma análise no histórico, se o histórico estiver ligado.
     * @param {import('../domain/history.js').HistoryItem} item
     * @returns {boolean} true se foi guardado
     */
    add(item) {
      const current = getSnapshot()
      if (!current.enabled) return false
      write(addHistoryItem(current.items, item))
      return true
    },

    /**
     * Exclui um item (RF20: some imediatamente). Devolve o item e a posição para permitir desfazer.
     * @param {string} id
     * @returns {{ item: import('../domain/history.js').HistoryItem, index: number } | null}
     */
    remove(id) {
      const { items } = getSnapshot()
      const index = items.findIndex((item) => item.id === id)
      if (index === -1) return null
      const item = items[index]
      write(items.filter((existing) => existing.id !== id))
      return { item, index }
    },

    /**
     * Devolve um item excluído à posição de origem (desfazer).
     * @param {import('../domain/history.js').HistoryItem} item
     * @param {number} index
     */
    restore(item, index) {
      const { items } = getSnapshot()
      if (items.some((existing) => existing.id === item.id)) return
      const next = [...items]
      next.splice(Math.min(index, next.length), 0, item)
      write(next)
    },

    /** Limpa todos os registros locais (RF20). */
    clear() {
      write([])
    },

    /** @param {boolean} enabled */
    setEnabled(enabled) {
      storage.setString(STORAGE_KEYS.historyEnabled, enabled ? 'true' : 'false')
    },
  }
}
