import { describe, expect, it } from 'vitest'
import { countCharacters, normalizeText } from './text.js'

// Caracteres invisíveis montados por código, para o arquivo continuar legível.
const ch = (...codes) => String.fromCharCode(...codes)

describe('normalizeText (espelha o back end)', () => {
  it('devolve vazio para nulo, indefinido e só espaços', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
    expect(normalizeText('  \n\t  ')).toBe('')
  })

  it('colapsa espaços e tabulações repetidos e apara cada linha', () => {
    expect(normalizeText('  olá   mundo \t !  \n   segunda   linha  ')).toBe('olá mundo !\nsegunda linha')
  })

  it('trata o espaço sem quebra (NBSP) como espaço comum', () => {
    expect(normalizeText(`a${ch(0xa0, 0xa0)}b`)).toBe('a b')
  })

  it('converte quebras de linha de Windows e Mac', () => {
    expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('reduz três ou mais quebras seguidas para duas', () => {
    expect(normalizeText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('remove caracteres de controle, de largura zero, separadores Unicode e BOM', () => {
    const dirty = `a${ch(0x00)}b${ch(0x200b)}c${ch(0xfeff)}d${ch(0x07)}e${ch(0x200f)}f${ch(0x2028)}g${ch(0x2029)}h${ch(0x85)}i`
    expect(normalizeText(dirty)).toBe('abcdefghi')
  })

  it('preserva tab e quebra de linha (não são removidos como controle)', () => {
    expect(normalizeText('a\nb')).toBe('a\nb')
  })

  it('normaliza Unicode para NFC (letra + acento solto vira um caractere só)', () => {
    const decomposed = `e${ch(0x0301)}` // e + acento agudo combinante
    expect(normalizeText(decomposed)).toBe('é')
    expect(countCharacters(normalizeText(decomposed))).toBe(1)
  })
})

describe('countCharacters', () => {
  it('conta pontos de código, como o Python do back end', () => {
    expect(countCharacters('abc')).toBe(3)
    expect(countCharacters('ação')).toBe(4)
    // Emoji fora do plano básico ocupa 2 unidades UTF-16, mas é 1 caractere.
    expect('😀'.length).toBe(2)
    expect(countCharacters('😀')).toBe(1)
  })
})
