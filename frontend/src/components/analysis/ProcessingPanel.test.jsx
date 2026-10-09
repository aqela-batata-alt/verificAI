import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestServices, renderWithApp } from '../../test/render.jsx'
import ProcessingPanel from './ProcessingPanel.jsx'

// RF25 (estado de espera honesto), RNF01 (prazo de 30 s) e RNF17 (confirmação imediata).

const TEXT = { inputType: 'text', text: 'A prefeitura anunciou que o transporte coletivo terá novos horários.' }
const URL = { inputType: 'url', url: 'https://exemplo.com/noticia' }

const clock = { now: 1_000_000 }
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  clock.now = 1_000_000
})
afterEach(() => {
  vi.useRealTimers()
})

function setup({ input = TEXT, startedAt = clock.now, onCancel = vi.fn() } = {}) {
  const services = createTestServices({ clock })
  const utils = renderWithApp(<ProcessingPanel input={input} startedAt={startedAt} onCancel={onCancel} />, { services })
  return { onCancel, ...utils }
}

/** Avança o relógio injetado e o temporizador do React ao mesmo tempo. */
async function pass(seconds) {
  clock.now += seconds * 1000
  await act(async () => {
    await vi.advanceTimersByTimeAsync(seconds * 1000)
  })
}

describe('confirmação imediata (RNF17)', () => {
  it('diz de cara que o conteúdo foi recebido e quanto a análise pode levar', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Recebemos o seu conteúdo.' })).toBeInTheDocument()
    expect(screen.getByText('A análise está em andamento e leva até 30 segundos.')).toBeInTheDocument()
  })

  it('leva o foco ao título, porque o botão que a pessoa apertou saiu da tela', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Recebemos o seu conteúdo.' })).toHaveFocus()
  })

  it('mostra o início do que foi enviado, para a pessoa conferir que enviou o conteúdo certo', () => {
    setup()
    expect(screen.getByText(/A prefeitura anunciou que o transporte coletivo/)).toBeInTheDocument()
  })

  it('texto longo aparece cortado só NA TELA DE ESPERA, com reticências (o envio é sempre o texto inteiro)', () => {
    const long = { inputType: 'text', text: 'palavra '.repeat(100) }
    const { container } = setup({ input: long })
    const quote = container.querySelector('.processing__quote')
    expect(quote.textContent).toMatch(/…”$/)
    expect(quote.textContent.length).toBeLessThan(220)
  })

  it('para link, mostra o endereço e descreve a etapa como leitura da página', () => {
    setup({ input: URL })
    expect(screen.getByText(/https:\/\/exemplo\.com\/noticia/)).toBeInTheDocument()
    expect(screen.getByText(/Leitura da página e análise/)).toBeInTheDocument()
  })
})

describe('RF25: só afirma o que é verdade', () => {
  it('lista duas etapas conhecidas: validação concluída e análise em andamento', () => {
    setup()
    const steps = screen.getByRole('list', { name: 'Etapas conhecidas' })
    const items = Array.from(steps.querySelectorAll('li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim())
    expect(items).toEqual(['Validação do conteúdo concluída', 'Análise do texto em andamento'])
  })

  it('não inventa etapas que a API síncrona não informa (extração de página, consulta a fontes)', () => {
    setup()
    expect(screen.queryByText(/extração/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fontes/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/consulta/i)).not.toBeInTheDocument()
  })

  it('não tem barra de progresso: uma barra pareceria andamento da análise', () => {
    const { container } = setup()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(container.querySelector('progress, meter')).toBeNull()
  })
})

describe('tempo e prazo (RNF01)', () => {
  it('mostra o tempo decorrido contra o limite de 30 s, em texto', async () => {
    setup()
    expect(screen.getByText('Tempo decorrido: 0 s (limite de 30 s)')).toBeInTheDocument()
    await pass(4)
    expect(screen.getByText('Tempo decorrido: 4 s (limite de 30 s)')).toBeInTheDocument()
  })

  it('até 9 s não há aviso; a partir de 10 s avisa que está demorando, na região "status"', async () => {
    const { container } = setup()
    const status = container.querySelector('[role="status"]')
    await pass(9)
    expect(status).toBeEmptyDOMElement()
    await pass(1)
    expect(status).toHaveTextContent('Está demorando mais do que o normal.')
    expect(status).toHaveTextContent('O limite é de 30 segundos')
  })

  it('a região de aviso existe desde o início (senão o leitor de tela não anuncia o que entrar nela)', () => {
    const { container } = setup()
    expect(container.querySelector('[role="status"]')).toBeInTheDocument()
  })
})

describe('cancelar', () => {
  it('o botão chama onCancel', async () => {
    vi.useRealTimers()
    const { onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar análise' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    vi.useRealTimers()
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
