// @ts-check
// Acesso à conta e envio de feedback.
//
// O back end ainda NÃO tem endpoints de conta, histórico sincronizado nem feedback (Etapa 4).
// Por isso a interface fala com "gateways": contratos pequenos que a tela usa. Hoje existem as
// versões de DEMONSTRAÇÃO abaixo, que funcionam só no navegador, não enviam nada a nenhum
// servidor e aparecem sempre com um aviso visível. Quando a Etapa 4 definir os endpoints,
// basta escrever a versão HTTP de cada gateway (mesmos métodos) e trocar em src/services/index.js.
//
// A versão de demonstração NÃO guarda e-mail nem senha: guarda só "entrou: sim/não" e se o
// usuário escolheu vincular o histórico local à conta (RF28).

import { STORAGE_KEYS } from './storage.js'

/**
 * @typedef {{ signedIn: boolean, historyLinked: boolean }} Session
 *
 * @typedef {{
 *   mode: 'demo' | 'real',
 *   getSession: () => Session,
 *   getSnapshot: () => Session,
 *   subscribe: (listener: () => void) => () => void,
 *   signUp: (credentials: { email: string, password: string }) => Promise<void>,
 *   signIn: (credentials: { email: string, password: string }) => Promise<void>,
 *   signOut: () => Promise<void>,
 *   requestRecovery: (input: { email: string }) => Promise<void>,
 *   linkHistory: (link: boolean) => Promise<void>,
 *   deleteAccount: () => Promise<void>,
 * }} AuthGateway
 *
 * @typedef {{
 *   mode: 'demo' | 'real',
 *   submit: (feedback: { analysisId: string, useful: boolean, comment: string }) => Promise<{ delivered: boolean }>,
 * }} FeedbackGateway
 */

/** @type {Readonly<Session>} */
const SIGNED_OUT = Object.freeze({ signedIn: false, historyLinked: false })

/**
 * @param {{ storage: import('./storage.js').AppStorage }} deps
 * @returns {AuthGateway}
 */
export function createDemoAuthGateway({ storage }) {
  /** @type {string | null | undefined} */
  let lastRaw
  /** @type {Session} */
  let cached = SIGNED_OUT

  function getSession() {
    const raw = storage.getString(STORAGE_KEYS.demoSession)
    if (raw !== lastRaw) {
      lastRaw = raw
      let parsed = null
      try {
        parsed = raw === null ? null : JSON.parse(raw)
      } catch {
        parsed = null
      }
      cached =
        parsed && typeof parsed === 'object' && parsed.signedIn === true
          ? { signedIn: true, historyLinked: parsed.historyLinked === true }
          : SIGNED_OUT
    }
    return cached
  }

  /** @param {Session} session */
  const save = (session) => {
    storage.setJSON(STORAGE_KEYS.demoSession, session)
  }

  return {
    mode: 'demo',
    getSession,
    getSnapshot: getSession,
    subscribe: (listener) => storage.subscribe(STORAGE_KEYS.demoSession, listener),
    async signUp() {
      save({ signedIn: true, historyLinked: false })
    },
    async signIn() {
      save({ signedIn: true, historyLinked: false })
    },
    async signOut() {
      storage.remove(STORAGE_KEYS.demoSession)
    },
    async requestRecovery() {
      // Demonstração: nenhuma mensagem é enviada.
    },
    async linkHistory(link) {
      const current = getSession()
      if (current.signedIn) save({ ...current, historyLinked: link })
    },
    async deleteAccount() {
      storage.remove(STORAGE_KEYS.demoSession)
    },
  }
}

/**
 * Feedback de demonstração: valida e descarta. Não grava nem envia nada (RF19 exige que o
 * feedback nunca vire rótulo de treino; aqui ele nem sai do navegador).
 * @returns {FeedbackGateway}
 */
export function createDemoFeedbackGateway() {
  return {
    mode: 'demo',
    async submit() {
      return { delivered: false }
    },
  }
}
