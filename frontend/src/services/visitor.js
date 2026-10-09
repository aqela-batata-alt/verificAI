// @ts-check
// Identificador anônimo do visitante (RNF19).
//
// É um identificador aleatório, gerado no navegador e guardado só no localStorage. Não usa
// impressão digital do dispositivo (user agent, tela, canvas etc.). Serve para o servidor
// manter um contador mínimo do limite de visitante (Etapa 4) e vai no cabeçalho X-Visitor-Id,
// que o back end já lê (limite de 64 caracteres). Limpar o armazenamento do navegador gera
// um identificador novo, e isso é um risco conhecido do MVP (RNF19).

import { STORAGE_KEYS } from './storage.js'

export const VISITOR_HEADER = 'X-Visitor-Id'

const VALID_ID = /^[A-Za-z0-9-]{16,64}$/

/** @returns {string} */
function randomId() {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Devolve o identificador guardado ou cria um novo. Só deve ser chamado quando uma análise
 * vai ser enviada, para não criar identificador em quem só está lendo o site.
 * @param {import('./storage.js').AppStorage} storage
 * @returns {string}
 */
export function getOrCreateVisitorId(storage) {
  const saved = storage.getString(STORAGE_KEYS.visitorId)
  if (saved && VALID_ID.test(saved)) return saved
  const fresh = randomId()
  storage.setString(STORAGE_KEYS.visitorId, fresh)
  return fresh
}
