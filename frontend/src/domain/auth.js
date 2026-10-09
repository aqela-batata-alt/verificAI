// @ts-check
// Validação dos campos de conta no navegador (RF31, RF32). É conveniência de interface: quem
// decide se a credencial vale é o servidor (Etapa 4).
//
// Decisões:
//  - RF31 pede "apenas os dados necessários": o cadastro tem e-mail e senha, nada mais.
//  - Senha: mínimo de 8 caracteres e nenhuma regra de composição (NIST SP 800-63B); colar é
//    permitido, para gerenciadores de senha funcionarem (WCAG 2.2, critério 3.3.8).

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 254

/** @typedef {{ ok: true } | { ok: false, code: string }} FieldResult */

/**
 * @param {string} raw
 * @returns {FieldResult}
 */
export function validateEmail(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return { ok: false, code: 'email_empty' }
  if (value.length > EMAIL_MAX_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, code: 'email_invalid' }
  }
  return { ok: true }
}

/**
 * @param {string} raw
 * @returns {FieldResult}
 */
export function validatePassword(raw) {
  const value = String(raw ?? '')
  if (!value) return { ok: false, code: 'password_empty' }
  if (value.length < PASSWORD_MIN_LENGTH) return { ok: false, code: 'password_short' }
  if (value.length > PASSWORD_MAX_LENGTH) return { ok: false, code: 'password_long' }
  return { ok: true }
}

/** Mensagens de campo em linguagem simples. */
export const FIELD_MESSAGES = Object.freeze({
  email_empty: 'Informe o seu e-mail.',
  email_invalid: 'Esse e-mail não parece válido. Confira se tem o @ e o final, como .com.',
  password_empty: 'Informe a sua senha.',
  password_short: `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  password_long: `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  privacy_unchecked: 'Marque a leitura da Política de Privacidade para criar a conta.',
})

/**
 * Valida o formulário de entrada.
 * @param {{ email: string, password: string }} values
 * @returns {Record<string, string>} mensagens por campo (vazio quando tudo está certo)
 */
export function validateSignIn({ email, password }) {
  /** @type {Record<string, string>} */
  const errors = {}
  const e = validateEmail(email)
  if (!e.ok) errors.email = FIELD_MESSAGES[/** @type {keyof typeof FIELD_MESSAGES} */ (e.code)]
  // Na entrada só exigimos que a senha exista: a regra de tamanho vale para criar a conta.
  if (!password) errors.password = FIELD_MESSAGES.password_empty
  return errors
}

/**
 * Valida o formulário de cadastro.
 * @param {{ email: string, password: string, acceptedPrivacy: boolean }} values
 * @returns {Record<string, string>}
 */
export function validateSignUp({ email, password, acceptedPrivacy }) {
  /** @type {Record<string, string>} */
  const errors = {}
  const e = validateEmail(email)
  if (!e.ok) errors.email = FIELD_MESSAGES[/** @type {keyof typeof FIELD_MESSAGES} */ (e.code)]
  const p = validatePassword(password)
  if (!p.ok) errors.password = FIELD_MESSAGES[/** @type {keyof typeof FIELD_MESSAGES} */ (p.code)]
  if (!acceptedPrivacy) errors.privacy = FIELD_MESSAGES.privacy_unchecked
  return errors
}

/**
 * Valida o formulário de recuperação de acesso.
 * @param {{ email: string }} values
 * @returns {Record<string, string>}
 */
export function validateRecovery({ email }) {
  /** @type {Record<string, string>} */
  const errors = {}
  const e = validateEmail(email)
  if (!e.ok) errors.email = FIELD_MESSAGES[/** @type {keyof typeof FIELD_MESSAGES} */ (e.code)]
  return errors
}
