import '@testing-library/jest-dom/vitest'
import { afterEach, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as axeMatchers from 'vitest-axe/matchers'

// Datas e horas dos testes seguem o fuso de Brasília, para resultados repetíveis.
process.env.TZ = 'America/Sao_Paulo'

expect.extend(axeMatchers)

// O jsdom não implementa <dialog> por completo: showModal()/close() e o atributo "open".
// Este polyfill cobre só o que a interface usa (modal, fechar, evento "close").
if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype
  if (!proto.showModal) {
    proto.showModal = function showModal() {
      this.setAttribute('open', '')
      this.setAttribute('data-modal', 'true')
    }
  }
  if (!proto.close) {
    proto.close = function close(returnValue) {
      if (returnValue !== undefined) this.returnValue = returnValue
      this.removeAttribute('open')
      this.removeAttribute('data-modal')
      this.dispatchEvent(new Event('close'))
    }
  }
}

// O axe tenta usar <canvas> para medir contraste; o jsdom não tem canvas e avisaria a cada teste.
// O contraste real é conferido pelo teste de tokens (tokens.test.js) e no navegador.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null
}

// Mensagens com rolagem e foco: o jsdom não implementa scrollIntoView.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
// O jsdom avisa "not implemented" a cada window.scrollTo; a interface só precisa que a chamada exista.
window.scrollTo = () => {}
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
