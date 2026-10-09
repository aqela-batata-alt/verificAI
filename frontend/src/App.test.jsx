import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'
import { DEFAULT_TITLE } from './hooks/useDocumentTitle.js'
import { makeApiAnalysis } from './test/fixtures.js'
import { createTestServices, jsonResponse, renderWithApp } from './test/render.jsx'

// Aplicação inteira: rotas (RF23), foco e título a cada troca de página (WCAG 2.4.2 e 2.4.3),
// aviso de demonstração, contas desligadas e a jornada principal de ponta a ponta.

const VALID_TEXT = 'A prefeitura anunciou que o transporte coletivo terá novos horários a partir da próxima semana.'

function renderApp({ route = '/', env, fetchImpl, services } = {}) {
  const s = services ?? createTestServices({ env, fetchImpl: fetchImpl ?? vi.fn(async () => jsonResponse(makeApiAnalysis(), { status: 201 })) })
  return renderWithApp(<App />, { route, services: s })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rotas (RF23)', () => {
  it.each([
    ['/', /Toda notícia merece/, DEFAULT_TITLE],
    ['/como-funciona', 'Verificar é ir além da manchete.', 'Como funciona — Apura'],
    ['/privacidade', 'Você precisa saber o que fica.', 'Privacidade — Apura'],
    ['/historico', 'Meu histórico', 'Meu histórico — Apura'],
    ['/entrar', 'Bom ter você por aqui.', 'Entrar — Apura'],
    ['/criar-conta', 'Crie sua conta.', 'Criar conta — Apura'],
    ['/recuperar-acesso', /Uma nova senha\./, 'Recuperar acesso — Apura'],
    ['/conta', 'Minha conta', 'Minha conta — Apura'],
    ['/uma/rota/que/nao/existe', 'Não encontramos esta página.', 'Página não encontrada — Apura'],
  ])('%s: tem um título de página (h1) e um título de aba próprios', async (route, heading, title) => {
    renderApp({ route })
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.title).toBe(title)
  })

  it('o resultado de uma análise é aberto pelo identificador', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(makeApiAnalysis()))
    renderApp({ route: '/resultado/7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11', fetchImpl })
    expect(await screen.findByRole('heading', { level: 2, name: 'Requer atenção' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Resultado da análise' })).toBeInTheDocument()
  })

  it('toda página tem os marcos de navegação: cabeçalho, navegação principal, conteúdo e rodapé', async () => {
    renderApp({ route: '/como-funciona' })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação secundária' })).toBeInTheDocument()
  })

  it('a navegação marca a página atual', async () => {
    renderApp({ route: '/como-funciona' })
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Como funciona' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Verificar notícia' })).not.toHaveAttribute('aria-current')
  })

  it('o logotipo é um link para o início, com nome acessível', async () => {
    renderApp({ route: '/privacidade' })
    const links = await screen.findAllByRole('link', { name: 'Apura — página inicial' })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) expect(link).toHaveAttribute('href', '/')
  })
})

describe('foco e rolagem ao trocar de página (WCAG 2.4.3)', () => {
  it('o atalho "Ir para o conteúdo" é o primeiro item da tabulação e leva o foco ao conteúdo', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1 })
    await userEvent.tab()
    const skip = screen.getByRole('link', { name: 'Ir para o conteúdo' })
    expect(skip).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('ao clicar num link da navegação, o foco vai para o título da página nova e a rolagem volta ao topo', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    renderApp()
    await screen.findByRole('heading', { level: 1 })
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Como funciona' }))
    const heading = await screen.findByRole('heading', { level: 1, name: 'Verificar é ir além da manchete.' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('na primeira exibição, o foco não é roubado (fica onde o navegador o pôs)', async () => {
    renderApp({ route: '/como-funciona' })
    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).not.toHaveFocus()
  })

  it('o índice da página de privacidade leva ao título da seção e o foca', async () => {
    renderApp({ route: '/privacidade' })
    const toc = await screen.findByRole('navigation', { name: 'Nesta página' })
    await userEvent.click(within(toc).getByRole('link', { name: /Histórico/ }))
    const heading = document.getElementById('historico-titulo')
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('um endereço com âncora (/privacidade#demonstracao) já abre na seção certa', async () => {
    renderApp({ route: '/privacidade#demonstracao' })
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(document.getElementById('demonstracao-titulo')).toHaveFocus())
  })

  it('âncora que não existe não quebra nada', async () => {
    renderApp({ route: '/privacidade#nao-existe' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Você precisa saber o que fica.' })).toBeInTheDocument()
  })
})

describe('menu em telas pequenas (APG, Disclosure Navigation)', () => {
  it('o botão "Menu" tem texto, informa se está aberto e controla a navegação', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1 })
    const button = screen.getByRole('button', { name: 'Menu' })
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', nav.id)
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(nav).toHaveAttribute('data-open', 'true')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1 })
    const button = screen.getByRole('button', { name: 'Menu' })
    await userEvent.click(button)
    await userEvent.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  })

  it('trocar de página fecha o menu', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1 })
    const button = screen.getByRole('button', { name: 'Menu' })
    await userEvent.click(button)
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Meu histórico' }))
    await screen.findByRole('heading', { level: 1, name: 'Meu histórico' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('aviso de demonstração', () => {
  it('aparece em toda página enquanto conta e avaliação forem de demonstração', async () => {
    renderApp({ route: '/historico' })
    const bar = await screen.findByRole('complementary', { name: 'Aviso de demonstração' })
    expect(bar).toHaveTextContent('DEMONSTRAÇÃO')
    expect(bar).toHaveTextContent('Conta, entrada e avaliações da análise funcionam só neste navegador.')
    expect(within(bar).getByRole('link', { name: 'O que isso significa' })).toHaveAttribute('href', '/privacidade#demonstracao')
  })

  it('só com a avaliação em demonstração, fala só dela (e concorda o verbo)', async () => {
    renderApp({ env: { VITE_ACCOUNTS_MODE: 'off' } })
    const bar = await screen.findByRole('complementary', { name: 'Aviso de demonstração' })
    expect(bar).toHaveTextContent('O envio de avaliações da análise funciona só neste navegador.')
  })

  it('só com a conta em demonstração, fala só dela', async () => {
    renderApp({ env: { VITE_FEEDBACK_MODE: 'off' } })
    const bar = await screen.findByRole('complementary', { name: 'Aviso de demonstração' })
    expect(bar).toHaveTextContent('Conta e entrada funcionam só neste navegador.')
  })

  it('some quando nada é de demonstração (gateways reais ligados)', async () => {
    // O instantâneo precisa ser sempre o mesmo objeto, senão o React entende que o estado muda sem parar.
    const signedOut = Object.freeze({ signedIn: false, historyLinked: false })
    const services = createTestServices({
      auth: { mode: 'real', getSnapshot: () => signedOut, subscribe: () => () => {} },
      feedback: { mode: 'real', submit: vi.fn() },
    })
    renderApp({ services })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('complementary', { name: 'Aviso de demonstração' })).not.toBeInTheDocument()
  })

  it('a página de privacidade explica a demonstração na seção para a qual o aviso aponta', async () => {
    renderApp({ route: '/privacidade' })
    const section = (await screen.findByRole('heading', { level: 1 })) && document.getElementById('demonstracao')
    expect(section).not.toBeNull()
    expect(section).toHaveTextContent(/não é enviado|não são enviados|nada é enviado/i)
  })
})

describe('contas desligadas na configuração (VITE_ACCOUNTS_MODE=off)', () => {
  const off = { VITE_ACCOUNTS_MODE: 'off' }

  it.each(['/entrar', '/criar-conta', '/recuperar-acesso', '/conta'])('%s não existe: mostra "página não encontrada"', async (route) => {
    renderApp({ route, env: off })
    expect(await screen.findByRole('heading', { level: 1, name: 'Não encontramos esta página.' })).toBeInTheDocument()
  })

  it('o cabeçalho e o rodapé não oferecem entrar nem conta', async () => {
    renderApp({ env: off })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: /Entrar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Minha conta/ })).not.toBeInTheDocument()
  })

  it('o resto do produto funciona: verificar, histórico, método e privacidade', async () => {
    renderApp({ route: '/historico', env: off })
    expect(await screen.findByRole('heading', { level: 1, name: 'Meu histórico' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
  })
})

describe('com contas ligadas', () => {
  it('o cabeçalho oferece "Entrar" e, depois de entrar, "Minha conta"', async () => {
    const services = createTestServices({ fetchImpl: vi.fn() })
    renderApp({ services })
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: /Entrar/ })).toHaveAttribute('href', '/entrar')
    await services.auth.signIn({ email: 'a@b.co', password: 'senha-de-teste-1' })
    expect(await within(nav).findByRole('link', { name: /Minha conta/ })).toHaveAttribute('href', '/conta')
  })
})

describe('rede de segurança (ErrorBoundary)', () => {
  it('se uma página quebrar, mostra uma saída em vez de tela em branco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom() {
      throw new Error('quebrou')
    }
    renderWithApp(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(within(screen.getByRole('main')).getByRole('alert')).toHaveTextContent('Algo não saiu como esperado.')
    expect(screen.getByRole('button', { name: 'Recarregar a página' })).toBeInTheDocument()
    expect(screen.queryByText(/quebrou/)).not.toBeInTheDocument()
  })

  it('sem erro, não interfere', () => {
    renderWithApp(
      <ErrorBoundary>
        <p>tudo bem</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('tudo bem')).toBeInTheDocument()
  })
})

describe('jornada principal, de ponta a ponta', () => {
  it('verificar → resultado → histórico → abrir sem nova chamada → excluir e desfazer', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(makeApiAnalysis(), { status: 201 }))
    const { services } = renderApp({ fetchImpl })

    // 1. Verificar um texto.
    await userEvent.type(await screen.findByRole('textbox', { name: 'Texto da notícia ou mensagem' }), VALID_TEXT)
    await userEvent.click(screen.getByRole('button', { name: /Verificar agora/ }))

    // 2. O resultado aparece, com a identidade do visitante enviada e o corpo só com o texto.
    expect(await screen.findByRole('heading', { level: 2, name: 'Requer atenção' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Resultado da análise' })).toBeInTheDocument()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('/api/v1/analyses/')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ input_type: 'text', text: VALID_TEXT })
    expect(init.headers['X-Visitor-Id'] ?? new Headers(init.headers).get('X-Visitor-Id')).toMatch(/\S{8,}/)

    // 3. O histórico guarda só a alegação resumida, o status e a data.
    const stored = services.history.getSnapshot().items
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ claim: 'Todas as linhas de ônibus deixarão de funcionar no próximo domingo.', status: 'requer_atencao' })
    expect(JSON.stringify(localStorage)).not.toContain('prefeitura anunciou')

    // 4. Pelo menu, vai ao histórico e abre o item sem chamar a API de novo (o resultado está em cache).
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Meu histórico' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Meu histórico' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /^Abrir/ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Requer atenção' })).toBeInTheDocument()
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // 5. Volta ao histórico, exclui e desfaz.
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Meu histórico' }))
    await userEvent.click(await screen.findByRole('button', { name: /Excluir do histórico/ }))
    expect(await screen.findByRole('heading', { name: 'Nada guardado por aqui ainda.' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findAllByRole('link', { name: /^Abrir/ })).toHaveLength(1)
  })

  it('depois do resultado, o formulário volta vazio: o texto enviado não fica em lugar nenhum', async () => {
    const { services } = renderApp()
    await userEvent.type(await screen.findByRole('textbox', { name: 'Texto da notícia ou mensagem' }), VALID_TEXT)
    await userEvent.click(screen.getByRole('button', { name: /Verificar agora/ }))
    await screen.findByRole('heading', { level: 2, name: 'Requer atenção' })
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Verificar notícia' }))
    expect(await screen.findByRole('textbox', { name: 'Texto da notícia ou mensagem' })).toHaveValue('')
    for (const store of [localStorage, sessionStorage]) {
      expect(JSON.stringify({ ...store })).not.toContain(VALID_TEXT.slice(0, 30))
    }
    expect(services.history.getSnapshot().items[0]).not.toHaveProperty('text')
  })

  it('a confirmação do envio aparece de imediato e a tela de espera tem o foco no título', async () => {
    let finish
    const fetchImpl = vi.fn(() => new Promise((resolve) => (finish = () => resolve(jsonResponse(makeApiAnalysis(), { status: 201 })))))
    renderApp({ fetchImpl })
    await userEvent.type(await screen.findByRole('textbox', { name: 'Texto da notícia ou mensagem' }), VALID_TEXT)
    await userEvent.click(screen.getByRole('button', { name: /Verificar agora/ }))
    const heading = await screen.findByRole('heading', { name: 'Recebemos o seu conteúdo.' })
    expect(heading).toHaveFocus()
    finish()
    expect(await screen.findByRole('heading', { level: 2, name: 'Requer atenção' })).toBeInTheDocument()
  })
})

describe('acessibilidade da aplicação inteira (axe)', () => {
  it.each(['/', '/como-funciona', '/privacidade', '/historico', '/entrar', '/criar-conta', '/recuperar-acesso', '/conta', '/nao-existe'])(
    '%s: sem violações, com cabeçalho, aviso e rodapé',
    async (route) => {
      const { container } = renderApp({ route })
      await screen.findByRole('heading', { level: 1 })
      expect(await axe(container)).toHaveNoViolations()
    },
  )
})
