import { describe, expect, it } from 'vitest'
import { createStorage, STORAGE_KEYS } from './storage.js'
import { VISITOR_HEADER, getOrCreateVisitorId } from './visitor.js'

describe('identificador anônimo do visitante (RNF19)', () => {
  it('só cria o identificador quando é pedido, e o reaproveita depois', () => {
    const storage = createStorage()
    expect(storage.getString(STORAGE_KEYS.visitorId)).toBeNull()
    const first = getOrCreateVisitorId(storage)
    expect(first).toMatch(/^[A-Za-z0-9-]{16,64}$/)
    expect(getOrCreateVisitorId(storage)).toBe(first)
    expect(storage.getString(STORAGE_KEYS.visitorId)).toBe(first)
  })

  it('cabe no limite de 64 caracteres da API', () => {
    expect(getOrCreateVisitorId(createStorage()).length).toBeLessThanOrEqual(64)
  })

  it('identificador guardado fora do formato é descartado e trocado', () => {
    const storage = createStorage()
    storage.setString(STORAGE_KEYS.visitorId, 'curto')
    const id = getOrCreateVisitorId(storage)
    expect(id).not.toBe('curto')
    storage.setString(STORAGE_KEYS.visitorId, '<script>alert(1)</script>'.padEnd(20, 'x'))
    expect(getOrCreateVisitorId(storage)).toMatch(/^[A-Za-z0-9-]{16,64}$/)
  })

  it('é aleatório: dois navegadores diferentes não repetem o identificador', () => {
    const a = getOrCreateVisitorId(createStorage({ backend: null }))
    const b = getOrCreateVisitorId(createStorage({ backend: null }))
    expect(a).not.toBe(b)
  })

  it('o cabeçalho tem o nome que o back end lê', () => {
    expect(VISITOR_HEADER).toBe('X-Visitor-Id')
  })
})
