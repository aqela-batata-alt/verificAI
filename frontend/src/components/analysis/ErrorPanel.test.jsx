import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { ACTION_LABELS, AppError, OTHER_SCENARIOS, RF27_SCENARIOS, describeError } from '../../domain/errors.js'
import { renderWithApp } from '../../test/render.jsx'
import ErrorPanel from './ErrorPanel.jsx'

// RF27: sete cenários de erro, cada um com um texto próprio e ao menos uma ação possível.
// Esta tabela é a prova de rastreabilidade: se um cenário perder o texto ou o botão, o teste quebra.

/** Um erro de exemplo para cada cenário, com os detalhes que a API (ou a validação) realmente manda. */
const SAMPLES = {
  invalid_url: { details: { reason: 'no_scheme' }, field: 'url' },
  page_unreachable: { field: 'url' },
  text_insufficient: { details: { length: 12, min_chars: 50 }, field: 'text' },
  unsupported_language: { field: 'text' },
  api_unavailable: {},
  evidence_failure: {},
  timeout: {},
  text_too_long: { details: { length: 5320, max_chars: 5000 }, field: 'text' },
  text_unreadable: { field: 'text' },
  url_unavailable: { field: 'url' },
  rate_limited: { retryAfterSeconds: 12 },
  incompatible_api: {},
  not_found: {},
  rejected: { apiMessage: 'Conteúdo recusado.', apiAction: 'Revise o texto.', field: 'text' },
  unknown: {},
}

const errorFor = (scenario) => new AppError({ scenario, ...SAMPLES[scenario] })

function panel(scenario, props = {}) {
  const onAction = vi.fn()
  const utils = renderWithApp(<ErrorPanel error={errorFor(scenario)} onAction={onAction} {...props} />)
  return { onAction, ...utils }
}

describe('RF27: os sete cenários obrigatórios', () => {
  it('são exatamente os sete do requisito, na ordem', () => {
    expect(RF27_SCENARIOS).toEqual([
      'invalid_url',
      'page_unreachable',
      'text_insufficient',
      'unsupported_language',
      'api_unavailable',
      'evidence_failure',
      'timeout',
    ])
  })

  it.each(RF27_SCENARIOS)('%s: título, mensagem e ao menos um botão com ação', (scenario) => {
    panel(scenario)
    const view = describeError(errorFor(scenario))
    expect(view.title.length).toBeGreaterThan(5)
    expect(view.message.length).toBeGreaterThan(20)
    expect(view.actions.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: view.title })).toBeInTheDocument()
    for (const action of view.actions) {
      expect(screen.getByRole(action === 'new_analysis' || action === 'open_history' ? 'link' : 'button', { name: ACTION_LABELS[action] })).toBeInTheDocument()
    }
  })

  it('cada cenário tem um título diferente: a pessoa distingue o que aconteceu', () => {
    const titles = RF27_SCENARIOS.map((scenario) => describeError(errorFor(scenario)).title)
    expect(new Set(titles).size).toBe(RF27_SCENARIOS.length)
  })

  it.each([...RF27_SCENARIOS, ...OTHER_SCENARIOS])('%s: o texto fala com a pessoa, não com o programador', (scenario) => {
    const { title, message } = describeError(errorFor(scenario))
    const text = `${title} ${message}`
    expect(text).not.toMatch(/undefined|null|\[object|Error:|stack|exception|HTTP \d{3}|\b[45]\d\d\b/i)
    expect(text).not.toMatch(/Fake Eyes/)
  })
})

describe('outros estados que a API real devolve', () => {
  it.each(OTHER_SCENARIOS)('%s: tem texto e ação', (scenario) => {
    panel(scenario)
    const view = describeError(errorFor(scenario))
    expect(screen.getByRole('heading', { name: view.title })).toBeInTheDocument()
    expect(view.actions.length).toBeGreaterThanOrEqual(1)
  })

  it('limite de requisições: informa o tempo de espera quando o servidor informa', () => {
    panel('rate_limited')
    expect(screen.getByText(/Aguarde cerca de 12 segundos/)).toBeInTheDocument()
  })

  it('limite de requisições sem tempo informado: pede um instante, sem inventar número', () => {
    renderWithApp(<ErrorPanel error={new AppError({ scenario: 'rate_limited' })} />)
    expect(screen.getByText('Aguarde um instante e tente de novo.')).toBeInTheDocument()
  })

  it('erro recusado com código desconhecido: repete a mensagem e a ação da API em português', () => {
    panel('rejected')
    expect(screen.getByText('Conteúdo recusado. Revise o texto.')).toBeInTheDocument()
  })
})

describe('comportamento do painel', () => {
  it('leva o foco ao painel (o leitor de tela anuncia o problema pela região "alert")', () => {
    const { container } = panel('api_unavailable')
    const root = container.querySelector('.error-panel')
    expect(root).toHaveFocus()
    expect(root).toHaveAttribute('tabindex', '-1')
    expect(root).toHaveAttribute('data-scenario', 'api_unavailable')
    expect(root.querySelector('[role="alert"]')).toHaveTextContent('O serviço de análise está indisponível.')
  })

  it('com focusOnMount desligado, não rouba o foco', () => {
    const { container } = panel('api_unavailable', { focusOnMount: false })
    expect(container.querySelector('.error-panel')).not.toHaveFocus()
  })

  it('um erro novo devolve o foco ao painel', async () => {
    function Harness() {
      const [error, setError] = useState(errorFor('api_unavailable'))
      return (
        <>
          <button type="button" onClick={() => setError(errorFor('timeout'))}>
            trocar o erro
          </button>
          <ErrorPanel error={error} />
        </>
      )
    }
    const { container } = renderWithApp(<Harness />)
    expect(container.querySelector('.error-panel')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'trocar o erro' }))
    await waitFor(() => expect(container.querySelector('.error-panel')).toHaveFocus())
    expect(container.querySelector('.error-panel')).toHaveAttribute('data-scenario', 'timeout')
  })

  it('erro do sistema aparece em vermelho; erro que a pessoa corrige, em âmbar (a cor só reforça o título)', () => {
    const { container, unmount } = panel('timeout')
    expect(container.querySelector('.error-panel')).toHaveClass('error-panel--error')
    unmount()
    const second = panel('text_insufficient')
    expect(second.container.querySelector('.error-panel')).toHaveClass('error-panel--warning')
  })

  it('o botão da ação chama onAction com o identificador da ação', async () => {
    const { onAction } = panel('page_unreachable')
    await userEvent.click(screen.getByRole('button', { name: ACTION_LABELS.paste_text }))
    expect(onAction).toHaveBeenCalledWith('paste_text')
    await userEvent.click(screen.getByRole('button', { name: ACTION_LABELS.retry }))
    expect(onAction).toHaveBeenLastCalledWith('retry')
  })

  it('a primeira ação é a principal; as outras ficam em contorno', () => {
    panel('page_unreachable')
    expect(screen.getByRole('button', { name: ACTION_LABELS.paste_text })).not.toHaveClass('btn--outline')
    expect(screen.getByRole('button', { name: ACTION_LABELS.retry })).toHaveClass('btn--outline')
  })

  it('enquanto há uma solicitação em curso, os botões de ação ficam desativados', () => {
    panel('api_unavailable', { busy: true })
    expect(screen.getByRole('button', { name: ACTION_LABELS.retry })).toBeDisabled()
  })

  it('análise não encontrada: as ações são links de navegação, não botões', () => {
    panel('not_found')
    expect(screen.getByRole('link', { name: ACTION_LABELS.new_analysis })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: ACTION_LABELS.open_history })).toHaveAttribute('href', '/historico')
  })

  it('usa o nível de título pedido (o painel mora em páginas com estruturas diferentes)', () => {
    renderWithApp(<ErrorPanel error={errorFor('timeout')} headingLevel={2} />)
    expect(screen.getByRole('heading', { level: 2, name: 'A análise demorou mais do que o esperado.' })).toBeInTheDocument()
  })

  it.each(['api_unavailable', 'page_unreachable', 'not_found'])('%s: sem violações de acessibilidade (axe)', async (scenario) => {
    const { container } = panel(scenario)
    expect(await axe(container)).toHaveNoViolations()
  })
})
