import { describe, expect, it } from 'vitest'
import {
  EMAIL_MAX_LENGTH,
  FIELD_MESSAGES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validatePassword,
  validateRecovery,
  validateSignIn,
  validateSignUp,
} from './auth.js'

describe('validateEmail', () => {
  it.each(['pessoa@exemplo.com', 'a.b+c@sub.exemplo.com.br', '  pessoa@exemplo.com  '])('aceita %j', (value) => {
    expect(validateEmail(value)).toEqual({ ok: true })
  })

  it('recusa vazio, só espaços, null e undefined com o código "email_empty"', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(validateEmail(/** @type {any} */ (value))).toEqual({ ok: false, code: 'email_empty' })
    }
  })

  it.each(['pessoa', 'pessoa@', '@exemplo.com', 'pessoa@exemplo', 'pessoa @exemplo.com', 'a@b@c.com'])(
    'recusa %j como "email_invalid"',
    (value) => {
      expect(validateEmail(value)).toEqual({ ok: false, code: 'email_invalid' })
    },
  )

  it('recusa e-mail maior que o limite de 254 caracteres', () => {
    const long = `${'a'.repeat(EMAIL_MAX_LENGTH)}@exemplo.com`
    expect(validateEmail(long)).toEqual({ ok: false, code: 'email_invalid' })
  })
})

describe('validatePassword', () => {
  it('aceita exatamente o mínimo e exatamente o máximo', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH))).toEqual({ ok: true })
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH))).toEqual({ ok: true })
  })

  it('recusa vazia, curta e longa demais', () => {
    expect(validatePassword('')).toEqual({ ok: false, code: 'password_empty' })
    expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toEqual({ ok: false, code: 'password_short' })
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toEqual({ ok: false, code: 'password_long' })
  })

  it('não impõe regras de composição (letra maiúscula, número ou símbolo)', () => {
    expect(validatePassword('somente minusculas')).toEqual({ ok: true })
    expect(validatePassword('12345678')).toEqual({ ok: true })
  })

  it('não apara espaços: a senha é aceita exatamente como foi digitada', () => {
    expect(validatePassword('        ')).toEqual({ ok: true })
  })
})

describe('formulários', () => {
  it('entrada: pede e-mail válido e qualquer senha preenchida (o tamanho só vale ao criar a conta)', () => {
    expect(validateSignIn({ email: 'pessoa@exemplo.com', password: 'curta' })).toEqual({})
    expect(validateSignIn({ email: '', password: '' })).toEqual({
      email: FIELD_MESSAGES.email_empty,
      password: FIELD_MESSAGES.password_empty,
    })
    expect(validateSignIn({ email: 'x', password: 'abc' })).toEqual({ email: FIELD_MESSAGES.email_invalid })
  })

  it('cadastro: e-mail, senha com no mínimo 8 caracteres e leitura da política de privacidade', () => {
    expect(validateSignUp({ email: 'pessoa@exemplo.com', password: '12345678', acceptedPrivacy: true })).toEqual({})
    expect(validateSignUp({ email: 'pessoa@exemplo.com', password: '1234567', acceptedPrivacy: true })).toEqual({
      password: FIELD_MESSAGES.password_short,
    })
    expect(validateSignUp({ email: 'pessoa@exemplo.com', password: '12345678', acceptedPrivacy: false })).toEqual({
      privacy: FIELD_MESSAGES.privacy_unchecked,
    })
  })

  it('cadastro: junta todos os erros de uma vez, para a pessoa corrigir tudo numa passada', () => {
    expect(validateSignUp({ email: '', password: '', acceptedPrivacy: false })).toEqual({
      email: FIELD_MESSAGES.email_empty,
      password: FIELD_MESSAGES.password_empty,
      privacy: FIELD_MESSAGES.privacy_unchecked,
    })
  })

  it('recuperação: só pede o e-mail', () => {
    expect(validateRecovery({ email: 'pessoa@exemplo.com' })).toEqual({})
    expect(validateRecovery({ email: 'pessoa' })).toEqual({ email: FIELD_MESSAGES.email_invalid })
  })

  it('o cadastro não pede nenhum dado além do necessário (RF31): só e-mail, senha e o aceite', () => {
    // Se um dia alguém acrescentar um campo ao cadastro, este teste lembra de conferir o RF31.
    const errors = validateSignUp({ email: '', password: '', acceptedPrivacy: false })
    expect(Object.keys(errors).sort()).toEqual(['email', 'password', 'privacy'])
  })

  it('as mensagens de campo estão em português claro, sem jargão nem códigos', () => {
    for (const message of Object.values(FIELD_MESSAGES)) {
      expect(message).toMatch(/[a-zà-ú]/i)
      expect(message).not.toMatch(/_|undefined|null|error/i)
    }
  })
})
