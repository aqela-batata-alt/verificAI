import { describe, expect, it, vi } from 'vitest'
import { createStorage } from './storage.js'

describe('createStorage', () => {
  it('guarda e lê JSON no localStorage do navegador', () => {
    const storage = createStorage()
    expect(storage.available).toBe(true)
    expect(storage.setJSON('apura:teste', { a: 1 })).toBe(true)
    expect(storage.getJSON('apura:teste')).toEqual({ a: 1 })
    expect(localStorage.getItem('apura:teste')).toBe('{"a":1}')
    storage.remove('apura:teste')
    expect(storage.getJSON('apura:teste')).toBeNull()
  })

  it('JSON corrompido vira null, sem lançar erro', () => {
    localStorage.setItem('apura:ruim', '{nao e json')
    expect(createStorage().getJSON('apura:ruim')).toBeNull()
  })

  it('sem armazenamento (janela privada, bloqueado), funciona só na memória', () => {
    const storage = createStorage({ backend: null })
    expect(storage.available).toBe(false)
    expect(storage.setJSON('k', [1, 2])).toBe(false)
    expect(storage.getJSON('k')).toEqual([1, 2])
    storage.remove('k')
    expect(storage.getJSON('k')).toBeNull()
  })

  it('quando o armazenamento lança exceção (cota cheia), cai para a memória', () => {
    const backend = {
      getItem: vi.fn(() => {
        throw new Error('bloqueado')
      }),
      setItem: vi.fn(() => {
        throw new Error('cota cheia')
      }),
      removeItem: vi.fn(() => {
        throw new Error('bloqueado')
      }),
    }
    const storage = createStorage({ backend: /** @type {any} */ (backend) })
    expect(storage.setString('k', 'v')).toBe(false)
    expect(storage.getString('k')).toBe('v')
    expect(() => storage.remove('k')).not.toThrow()
  })

  it('avisa quem assina quando o valor muda nesta aba', () => {
    const storage = createStorage()
    const listener = vi.fn()
    const off = storage.subscribe('apura:x', listener)
    storage.setString('apura:x', '1')
    storage.remove('apura:x')
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    storage.setString('apura:x', '2')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('avisa quando outra aba muda o valor (evento "storage")', () => {
    const storage = createStorage()
    const listener = vi.fn()
    const off = storage.subscribe('apura:y', listener)
    window.dispatchEvent(new StorageEvent('storage', { key: 'apura:y' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'apura:outra' }))
    expect(listener).toHaveBeenCalledTimes(1)
    off()
  })
})
