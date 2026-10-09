// @ts-check
// Cache de resultados SÓ NA MEMÓRIA da página (nunca no armazenamento do navegador).
// Evita buscar de novo o resultado que acabou de chegar. Ao recarregar a página, some, e o
// resultado é buscado outra vez em GET /api/v1/analyses/{id}/.

/**
 * @param {number} [limit] quantos resultados manter
 */
export function createResultCache(limit = 20) {
  /** @type {Map<string, import('../domain/analysis.js').Analysis>} */
  const map = new Map()
  return {
    /** @param {string} id */
    get: (id) => map.get(id) ?? null,
    /** @param {import('../domain/analysis.js').Analysis} analysis */
    put(analysis) {
      map.delete(analysis.id)
      map.set(analysis.id, analysis)
      while (map.size > limit) {
        const oldest = map.keys().next().value
        if (oldest === undefined) break
        map.delete(oldest)
      }
    },
  }
}
