import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VISITOR_LIMIT } from '../domain/limits.js'
import { STORAGE_KEYS } from '../services/storage.js'
import { apiErrors, apiInconclusive, makeApiAnalysis } from '../test/fixtures.js'
import { createTestServices, jsonResponse, renderWithApp } from '../test/render.jsx'
import { useAnalysisRun } from './analysisRun.jsx'

const TEXT = 'a'.repeat(60)

/** Componente de teste que expõe a execução de análise por botões e texto. */
function Probe() {
  const run = useAnalysisRun()
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <button onClick={() => navigate('/historico')}>ir-historico</button>
      <p data-testid="phase">{run.phase}</p>
      <p data-testid="path">{location.pathname}</p>
      <p data-testid="error">{run.error?.scenario ?? ''}</p>
      <p data-testid="draft">{run.draft.text}</p>
      <button onClick={() => run.setDraft({ text: 'rascunho digitado' })}>rascunho</button>
      <button onClick={() => run.start({ inputType: 'text', text: TEXT })}>enviar</button>
      <button onClick={() => run.start({ inputType: 'url', url: 'https://exemplo.com/x' })}>enviar-url</button>
      <button
        onClick={async () => {
          const result = await run.start({ inputType: 'text', text: TEXT })
          document.body.dataset.lastStart = JSON.stringify(result)
        }}
      >
        enviar-e-ver
      </button>
      <button onClick={run.retry}>repetir</button>
      <button onClick={run.cancel}>cancelar</button>
      <button onClick={run.dismissError}>fechar-erro</button>
    </div>
  )
}

const ui = (
  <Routes>
    <Route path="/" element={<Probe />} />
    <Route path="/resultado/:id" element={<Probe />} />
    <Route path="/historico" element={<Probe />} />
  </Routes>
)

const created = (body = makeApiAnalysis()) => jsonResponse(body, { status: 201 })

/** fetch que só responde quando o teste mandar. */
function deferredFetch() {
  /** @type {((r: Response) => void)[]} */
  const resolvers = []
  const fetchImpl = vi.fn(
    (_url, { signal }) =>
      new Promise((resolve, reject) => {
        resolvers.push(resolve)
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
  )
  return { fetchImpl, respond: (response) => resolvers.shift()(response) }
}

describe('execução da análise (RF24, RF25, RF33, RNF01, RNF17)', () => {
  it('RNF17: o estado "analisando" aparece no mesmo clique, sem esperar a resposta', async () => {
    const { fetchImpl } = deferredFetch()
    renderWithApp(ui, { services: createTestServices({ fetchImpl }) })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    expect(screen.getByTestId('phase')).toHaveTextContent('running')
  })

  it('RF25: um segundo envio durante a análise é ignorado (nada de requisição duplicada)', async () => {
    const { fetchImpl, respond } = deferredFetch()
    renderWithApp(ui, { services: createTestServices({ fetchImpl }) })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await userEvent.click(screen.getByRole('button', { name: 'enviar-url' }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await act(async () => respond(created()))
  })

  it('sucesso na tela inicial: conta no limite, guarda no histórico e abre o resultado', async () => {
    const fetchImpl = vi.fn(async () => created())
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/resultado/7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11'))
    expect(services.visitorLimit.remaining()).toBe(2)
    const [saved] = services.history.getSnapshot().items
    expect(saved).toMatchObject({ id: '7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11', status: 'requer_atencao', inputType: 'text' })
    // O resultado fica no cache para a página de resultado não buscar de novo.
    expect(services.results.get(saved.id)).not.toBeNull()
  })

  it('RF33: análise inconclusiva também conta no limite', async () => {
    const fetchImpl = vi.fn(async () => created(apiInconclusive()))
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/resultado/'))
    expect(services.visitorLimit.remaining()).toBe(2)
    expect(services.history.getSnapshot().items[0].status).toBe('analise_inconclusiva')
  })

  it('RF33: validação rejeitada pelo servidor não consome o limite e não entra no histórico', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiErrors.unsupportedLanguage, { status: 400 }))
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('failed'))
    expect(screen.getByTestId('error')).toHaveTextContent('unsupported_language')
    expect(services.visitorLimit.remaining()).toBe(3)
    expect(services.history.getSnapshot().items).toEqual([])
  })

  it('RF33: falha técnica (503) também não consome o limite', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiErrors.analysisUnavailable, { status: 503 }))
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('api_unavailable'))
    expect(services.visitorLimit.remaining()).toBe(3)
  })

  it('RF33: a quarta análise na janela não inicia processamento', async () => {
    const fetchImpl = vi.fn(async () => created())
    const clock = { now: Date.UTC(2026, 9, 8, 12, 0, 0) }
    const services = createTestServices({ fetchImpl, clock })
    for (let i = 0; i < VISITOR_LIMIT.max; i += 1) services.visitorLimit.registerCounted()
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar-e-ver' }))
    await waitFor(() => expect(document.body.dataset.lastStart).toBeDefined())
    expect(JSON.parse(document.body.dataset.lastStart)).toEqual({ started: false, reason: 'limit' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(screen.getByTestId('phase')).toHaveTextContent('idle')
  })

  it('RF33: decorridas 24 h, o contador reinicia e a análise volta a ser permitida', async () => {
    const fetchImpl = vi.fn(async () => created())
    const clock = { now: Date.UTC(2026, 9, 8, 12, 0, 0) }
    const services = createTestServices({ fetchImpl, clock })
    for (let i = 0; i < VISITOR_LIMIT.max; i += 1) services.visitorLimit.registerCounted()
    clock.now += VISITOR_LIMIT.windowMs
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1))
  })

  it('RF31/RF33: quem entrou numa conta não tem o limite de visitante', async () => {
    const fetchImpl = vi.fn(async () => created())
    const clock = { now: Date.UTC(2026, 9, 8, 12, 0, 0) }
    const services = createTestServices({ fetchImpl, clock })
    for (let i = 0; i < VISITOR_LIMIT.max; i += 1) services.visitorLimit.registerCounted()
    await services.auth.signIn({ email: 'a@b.co', password: '12345678' })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1))
    // E não gasta o contador de visitante.
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/resultado/'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.visitorLimit)).count).toBe(3)
  })

  it('cancelar interrompe a requisição, volta ao início e não consome o limite', async () => {
    const { fetchImpl } = deferredFetch()
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await userEvent.click(screen.getByRole('button', { name: 'cancelar' }))
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('idle'))
    expect(screen.getByTestId('error')).toHaveTextContent('')
    expect(services.visitorLimit.remaining()).toBe(3)
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('o rascunho sobrevive a um erro e é limpo depois de um resultado', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(apiErrors.textTooShort, { status: 400 }))
      .mockResolvedValueOnce(created())
    renderWithApp(ui, { services: createTestServices({ fetchImpl }) })
    await userEvent.click(screen.getByRole('button', { name: 'rascunho' }))
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('failed'))
    expect(screen.getByTestId('draft')).toHaveTextContent('rascunho digitado')
    await userEvent.click(screen.getByRole('button', { name: 'repetir' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/resultado/'))
    expect(screen.getByTestId('draft')).toHaveTextContent('')
  })

  it('"tentar de novo" repete exatamente a mesma entrada', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(apiErrors.analysisUnavailable, { status: 503 }))
      .mockResolvedValueOnce(created())
    renderWithApp(ui, { services: createTestServices({ fetchImpl }) })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('failed'))
    await userEvent.click(screen.getByRole('button', { name: 'repetir' }))
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    expect(fetchImpl.mock.calls[1][1].body).toBe(fetchImpl.mock.calls[0][1].body)
  })

  it('fechar o erro volta ao estado inicial', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(apiErrors.analysisUnavailable, { status: 503 }))
    renderWithApp(ui, { services: createTestServices({ fetchImpl }) })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('failed'))
    await userEvent.click(screen.getByRole('button', { name: 'fechar-erro' }))
    expect(screen.getByTestId('phase')).toHaveTextContent('idle')
  })

  it('quando a pessoa saiu da tela inicial durante a espera, não troca a tela: avisa e oferece o link do resultado', async () => {
    const { fetchImpl, respond } = deferredFetch()
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }))
    // Sai da tela inicial enquanto a análise continua.
    await userEvent.click(screen.getByRole('button', { name: 'ir-historico' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/historico')
    expect(screen.getByTestId('phase')).toHaveTextContent('running')

    await act(async () => respond(created()))

    await waitFor(() => expect(services.history.getSnapshot().items).toHaveLength(1))
    expect(screen.getByTestId('path')).toHaveTextContent('/historico')
    expect(await screen.findByText('Sua análise terminou.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver resultado' })).toHaveAttribute(
      'href',
      '/resultado/7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11',
    )
  })

  it('o aviso de análise concluída não some sozinho (a pessoa pode estar lendo outra coisa)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { fetchImpl, respond } = deferredFetch()
      const services = createTestServices({ fetchImpl })
      renderWithApp(ui, { services })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByRole('button', { name: 'enviar' }))
      await user.click(screen.getByRole('button', { name: 'ir-historico' }))
      await act(async () => respond(created()))
      expect(await screen.findByText('Sua análise terminou.')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000)
      })
      expect(screen.getByText('Sua análise terminou.')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('RNF01: prazo de 30 s', () => {
  // "shouldAdvanceTime" é necessário porque o Testing Library espera um setTimeout(0) real depois
  // de cada ação do usuário. Por isso o teste usa margem (29 s ainda espera; 31 s já falhou) em
  // vez de cravar o milésimo; o limite exato de 30.000 ms é verificado em services/http.test.js.
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('passou de 30 s sem resposta, a tela recebe o erro "timeout" e o limite não é consumido', async () => {
    const { fetchImpl } = deferredFetch()
    const services = createTestServices({ fetchImpl })
    renderWithApp(ui, { services })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'enviar' }))
    expect(screen.getByTestId('phase')).toHaveTextContent('running')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000)
    })
    expect(screen.getByTestId('phase')).toHaveTextContent('running')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(screen.getByTestId('phase')).toHaveTextContent('failed')
    expect(screen.getByTestId('error')).toHaveTextContent('timeout')
    expect(services.visitorLimit.remaining()).toBe(3)
  })
})
