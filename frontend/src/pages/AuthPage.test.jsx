import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { createDemoAuthGateway } from '../services/gateways.js'
import { createStorage, STORAGE_KEYS } from '../services/storage.js'
import { createTestServices, renderWithApp } from '../test/render.jsx'
import AccountPage from './AccountPage.jsx'
import AuthPage from './AuthPage.jsx'

// RF31 (entrar e criar conta com os dados necessários), RF28 (vincular o histórico só com
// confirmação explícita) e RF32 (nada de conta para quem não entrou).

const HISTORY = [
  { id: 'a1', claim: 'Todas as linhas de ônibus deixarão de funcionar no domingo.', status: 'requer_atencao', createdAt: '2026-10-08T11:53:00Z', inputType: 'text' },
  { id: 'a2', claim: 'Biblioteca municipal anuncia programação de leitura.', status: 'poucos_sinais_de_risco', createdAt: '2026-10-07T09:10:00Z', inputType: 'text' },
]
const EMAIL = 'maria@exemplo.com'
const PASSWORD = 'uma-senha-longa-1'

function Where() {
  const location = useLocation()
  return <p data-testid="onde">{location.pathname}</p>
}

/** @param {{ history?: typeof HISTORY, signedIn?: boolean, gateway?: (demo: any) => any, route?: string }} [options] */
function setup({ history = [], signedIn = false, gateway, route = '/entrar' } = {}) {
  const storage = createStorage()
  const demo = createDemoAuthGateway({ storage })
  const auth = gateway ? gateway(demo) : demo
  const services = createTestServices({ storage, auth })
  for (const item of [...history].reverse()) services.history.add(item)
  if (signedIn) storage.setJSON(STORAGE_KEYS.demoSession, { signedIn: true, historyLinked: false })
  const utils = renderWithApp(
    <>
      <Where />
      <Routes>
        <Route path="/entrar" element={<AuthPage mode="signin" />} />
        <Route path="/criar-conta" element={<AuthPage mode="signup" />} />
        <Route path="/conta" element={<AccountPage />} />
        <Route path="/recuperar-acesso" element={<p>RECUPERAR</p>} />
        <Route path="/privacidade" element={<p>PRIVACIDADE</p>} />
        <Route path="/" element={<p>INÍCIO</p>} />
      </Routes>
    </>,
    { route, services },
  )
  return { services, storage, auth, ...utils }
}

const where = () => screen.getByTestId('onde').textContent
const emailField = () => screen.getByLabelText('E-mail')
const passwordField = () => screen.getByLabelText('Senha')
const session = (storage) => storage.getJSON(STORAGE_KEYS.demoSession)

async function fillSignIn() {
  await userEvent.type(emailField(), EMAIL)
  await userEvent.type(passwordField(), PASSWORD)
}

describe('entrar', () => {
  it('pede e-mail e senha, avisa que a conexão é de demonstração e oferece as saídas', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Bom ter você por aqui.' })).toBeInTheDocument()
    expect(emailField()).toHaveAttribute('type', 'email')
    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(screen.getByText(/Conexão apenas demonstrativa: o e-mail e a senha digitados não são guardados nem enviados/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/recuperar-acesso')
    expect(screen.getByRole('link', { name: 'Continuar sem uma conta' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'Acesso' })).toBeInTheDocument()
  })

  it('campos com a sugestão certa para o gerenciador de senhas', () => {
    setup()
    expect(emailField()).toHaveAttribute('autocomplete', 'username')
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('formulário vazio: escreve o que falta nos dois campos e leva o foco ao primeiro', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe o seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe a sua senha.')).toBeInTheDocument()
    expect(emailField()).toHaveFocus()
    expect(emailField()).toHaveAttribute('aria-invalid', 'true')
    expect(emailField()).toHaveAccessibleDescription('Informe o seu e-mail.')
  })

  it('e-mail sem o final: explica o que conferir', async () => {
    setup()
    await userEvent.type(emailField(), 'maria@exemplo')
    await userEvent.type(passwordField(), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText(/Esse e-mail não parece válido/)).toBeInTheDocument()
    expect(emailField()).toHaveFocus()
  })

  it('na entrada, a regra de tamanho da senha não é cobrada (vale só para criar a conta)', async () => {
    setup()
    await userEvent.type(emailField(), EMAIL)
    await userEvent.type(passwordField(), 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.queryByText(/Use pelo menos 8 caracteres/)).not.toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/'))
  })

  it('mostrar a senha: o botão mantém o nome e muda só o estado', async () => {
    setup()
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.type(passwordField(), PASSWORD)
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(passwordField()).toHaveAttribute('type', 'text')
    expect(passwordField()).toHaveValue(PASSWORD)
  })

  it('permite colar a senha (gerenciadores de senha; WCAG 3.3.8)', async () => {
    setup()
    await userEvent.click(passwordField())
    await userEvent.paste(PASSWORD)
    expect(passwordField()).toHaveValue(PASSWORD)
  })

  it('entrou sem histórico neste navegador: avisa e volta ao início (e não cai em "Minha conta")', async () => {
    const { storage } = setup()
    await fillSignIn()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Você entrou.')).toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/'))
    expect(screen.getByText('INÍCIO')).toBeInTheDocument()
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
  })

  it('a demonstração não guarda nem o e-mail nem a senha', async () => {
    const { storage } = setup()
    await fillSignIn()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(where()).toBe('/'))
    const everything = Object.keys(localStorage)
      .map((key) => localStorage.getItem(key))
      .join('\n')
    expect(everything).not.toContain(EMAIL)
    expect(everything).not.toContain(PASSWORD)
    expect(JSON.stringify(session(storage))).not.toContain('@')
  })

  it('falha ao entrar: mensagem única, que não revela se a conta existe, e o botão volta a funcionar', async () => {
    setup({ gateway: (demo) => ({ ...demo, signIn: vi.fn().mockRejectedValue(new Error('401')) }) })
    await fillSignIn()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    const alert = await screen.findByText('Não foi possível entrar. Confira o e-mail e a senha e tente de novo.')
    expect(alert.closest('[role="alert"]')).toBeInTheDocument()
    expect(alert.textContent).not.toMatch(/não existe|não encontrad|cadastrad|incorret[ao] (e-mail|senha)/i)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(where()).toBe('/entrar')
  })

  it('um clique duplo não envia duas vezes', async () => {
    let release
    const signIn = vi.fn(() => new Promise((resolve) => (release = resolve)))
    setup({ gateway: (demo) => ({ ...demo, signIn }) })
    await fillSignIn()
    const button = screen.getByRole('button', { name: 'Entrar' })
    await userEvent.dblClick(button)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Aguarde…' })).toBeDisabled()
    await act(async () => release())
  })

  it('quem já entrou é levado a "Minha conta"', async () => {
    setup({ signedIn: true })
    await waitFor(() => expect(where()).toBe('/conta'))
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('criar conta (RF31: só os dados necessários)', () => {
  const open = (options) => setup({ route: '/criar-conta', ...options })

  it('pede e-mail, senha e a leitura da política — e mais nada', () => {
    const { container } = open()
    expect(screen.getByRole('heading', { level: 1, name: 'Crie sua conta.' })).toBeInTheDocument()
    expect(screen.getByText('Só pedimos e-mail e senha.')).toBeInTheDocument()
    expect(container.querySelectorAll('input:not([type="checkbox"])')).toHaveLength(2)
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument()
    expect(passwordField()).toHaveAccessibleDescription('Use pelo menos 8 caracteres.')
    expect(emailField()).toHaveAttribute('autocomplete', 'email')
    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password')
  })

  it('o link da política abre em outra aba e diz isso a quem usa leitor de tela', () => {
    open()
    const link = screen.getByRole('link', { name: /Política de Privacidade/ })
    expect(link).toHaveAttribute('href', '/privacidade')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toMatch(/noopener/)
    // O jsdom junta o texto visível e o texto só para leitor de tela sem espaço; o navegador mantém o espaço.
    expect(link).toHaveAccessibleName(/^Política de Privacidade\s*\(abre em uma nova aba\)$/)
  })

  it('senha curta e política sem marcar: escreve os dois problemas e foca o primeiro campo com erro', async () => {
    open()
    await userEvent.type(emailField(), EMAIL)
    await userEvent.type(passwordField(), 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getAllByText('Use pelo menos 8 caracteres.').length).toBeGreaterThan(0)
    expect(screen.getByText('Marque a leitura da Política de Privacidade para criar a conta.')).toBeInTheDocument()
    expect(passwordField()).toHaveFocus()
  })

  it('só a política sem marcar: o foco vai para a caixa de seleção', async () => {
    open()
    await userEvent.type(emailField(), EMAIL)
    await userEvent.type(passwordField(), PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveFocus()
    expect(checkbox).toHaveAttribute('aria-invalid', 'true')
  })

  it('a linha inteira da caixa é clicável', async () => {
    open()
    await userEvent.click(screen.getByText(/^Li a/))
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('cria a conta, avisa e vai ao início', async () => {
    const { storage } = open()
    await fillSignIn()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Conta criada. Você já pode continuar.')).toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/'))
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
  })

  it('falha ao criar: avisa e mantém o que a pessoa digitou', async () => {
    open({ gateway: (demo) => ({ ...demo, signUp: vi.fn().mockRejectedValue(new Error('500')) }) })
    await fillSignIn()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Não foi possível criar a conta agora. Tente de novo em instantes.')).toBeInTheDocument()
    expect(emailField()).toHaveValue(EMAIL)
    expect(where()).toBe('/criar-conta')
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = open()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('RF28: histórico deste navegador na hora de entrar', () => {
  async function signInWithHistory(options) {
    const utils = setup({ history: HISTORY, ...options })
    await fillSignIn()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Vincular o histórico à sua conta?' })
    return { ...utils, dialog }
  }

  it('pergunta, diz quantas verificações existem e coloca o foco no botão seguro', async () => {
    const { dialog } = await signInWithHistory()
    expect(dialog).toHaveTextContent('Há 2 verificações guardadas neste navegador.')
    expect(dialog).toHaveTextContent('Demonstração: a escolha fica marcada neste navegador e nada é enviado a um servidor.')
    expect(within(dialog).getByRole('button', { name: 'Agora não' })).toHaveFocus()
    // Enquanto a pergunta está aberta, a pessoa continua nesta página (e não é jogada em "Minha conta").
    expect(where()).toBe('/entrar')
  })

  it('um item só: fala no singular', async () => {
    const utils = setup({ history: [HISTORY[0]] })
    await fillSignIn()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Há 1 verificação guardada neste navegador.')
    utils.unmount()
  })

  it('"Vincular histórico": vincula e vai ao início', async () => {
    const { dialog, storage } = await signInWithHistory()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vincular histórico' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: true })
  })

  it('"Agora não": não vincula nada e vai ao início', async () => {
    const { dialog, storage } = await signInWithHistory()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agora não' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
  })

  it('fechar a janela sem responder equivale a "Agora não": nada é vinculado', async () => {
    const { dialog, storage } = await signInWithHistory()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar janela' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(session(storage).historyLinked).toBe(false)
  })

  it('Esc também equivale a "Agora não"', async () => {
    const { dialog, storage } = await signInWithHistory()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(session(storage).historyLinked).toBe(false)
  })

  it('falha ao vincular: avisa que o histórico continua no navegador e segue para o início', async () => {
    const { dialog } = await signInWithHistory({
      gateway: (demo) => ({ ...demo, linkHistory: vi.fn().mockRejectedValue(new Error('x')) }),
    })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vincular histórico' }))
    expect(await screen.findByText('Não foi possível vincular o histórico agora. Ele continua neste navegador.')).toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/'))
  })

  it('o histórico local continua intacto depois da escolha', async () => {
    const { dialog, services } = await signInWithHistory()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vincular histórico' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(services.history.getSnapshot().items).toHaveLength(2)
  })

  it('criar conta com histórico também pergunta, e termina no início', async () => {
    const { storage } = setup({ history: HISTORY, route: '/criar-conta' })
    await fillSignIn()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Vincular o histórico à sua conta?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Agora não' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
  })
})
