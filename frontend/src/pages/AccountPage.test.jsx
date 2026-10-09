import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { createDemoAuthGateway } from '../services/gateways.js'
import { createStorage, STORAGE_KEYS } from '../services/storage.js'
import { createTestServices, renderWithApp } from '../test/render.jsx'
import AccountPage from './AccountPage.jsx'

// RF28 (vincular o histórico só com confirmação), RF31/RF32 (sem sessão, nada da conta),
// RF34 (excluir a conta explica o efeito antes de pedir a confirmação).

const HISTORY = [
  { id: 'a1', claim: 'Todas as linhas de ônibus deixarão de funcionar no domingo.', status: 'requer_atencao', createdAt: '2026-10-08T11:53:00Z', inputType: 'text' },
  { id: 'a2', claim: 'Biblioteca municipal anuncia programação de leitura.', status: 'poucos_sinais_de_risco', createdAt: '2026-10-07T09:10:00Z', inputType: 'text' },
]

function Where() {
  return <p data-testid="onde">{useLocation().pathname}</p>
}

function setup({ history = [], signedIn = true, linked = false, gateway } = {}) {
  const storage = createStorage()
  const demo = createDemoAuthGateway({ storage })
  const auth = gateway ? gateway(demo) : demo
  const services = createTestServices({ storage, auth })
  for (const item of [...history].reverse()) services.history.add(item)
  if (signedIn) storage.setJSON(STORAGE_KEYS.demoSession, { signedIn: true, historyLinked: linked })
  const utils = renderWithApp(
    <>
      <Where />
      <Routes>
        <Route path="/conta" element={<AccountPage />} />
        <Route path="/entrar" element={<p>ENTRAR</p>} />
        <Route path="/criar-conta" element={<p>CRIAR CONTA</p>} />
        <Route path="/historico" element={<p>HISTÓRICO</p>} />
        <Route path="/privacidade" element={<p>PRIVACIDADE</p>} />
        <Route path="/" element={<p>INÍCIO</p>} />
      </Routes>
    </>,
    { route: '/conta', services },
  )
  return { services, storage, ...utils }
}

const where = () => screen.getByTestId('onde').textContent
const session = (storage) => storage.getJSON(STORAGE_KEYS.demoSession)

describe('sem sessão (RF32)', () => {
  it('não mostra nada da conta nem do histórico vinculado; só oferece entrar ou criar conta', () => {
    setup({ signedIn: false, history: HISTORY })
    expect(screen.getByRole('heading', { name: 'Acesse sua conta.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Entrar/ })).toHaveAttribute('href', '/entrar')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/criar-conta')
    expect(screen.queryByText('Excluir conta')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByText(/Biblioteca municipal/)).not.toBeInTheDocument()
  })

  it('lembra que a conta é opcional', () => {
    setup({ signedIn: false })
    expect(screen.getByText(/Você não precisa de conta para verificar um conteúdo/)).toBeInTheDocument()
  })
})

describe('com sessão', () => {
  it('na demonstração, diz com todas as letras que nada é enviado a um servidor', () => {
    setup()
    expect(screen.getByText('Conta de demonstração')).toBeInTheDocument()
    expect(screen.getByText('Nada é enviado a um servidor.')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Menu da conta' })).toBeInTheDocument()
  })

  it('"Sair da conta" encerra a sessão, avisa e volta ao início', async () => {
    const { storage } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByText('Você saiu da conta.')).toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/'))
    expect(storage.getString(STORAGE_KEYS.demoSession)).toBeNull()
  })

  it('falha ao sair: avisa e continua na conta', async () => {
    setup({ gateway: (demo) => ({ ...demo, signOut: vi.fn().mockRejectedValue(new Error('x')) }) })
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByText('Não foi possível sair agora. Tente de novo.')).toBeInTheDocument()
    expect(where()).toBe('/conta')
  })
})

describe('RF28: vincular o histórico', () => {
  it('começa desvinculado e explica o que isso significa', () => {
    setup({ history: HISTORY })
    const toggle = screen.getByRole('switch', { name: 'Vincular' })
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription('Hoje o histórico fica só neste navegador. Vincular depende da sua confirmação.')
  })

  it('ligar a chave NÃO vincula: abre a pergunta, e nada acontece até a confirmação', async () => {
    const { storage } = setup({ history: HISTORY })
    await userEvent.click(screen.getByRole('switch', { name: 'Vincular' }))
    const dialog = await screen.findByRole('dialog', { name: 'Vincular o histórico à sua conta?' })
    expect(dialog).toHaveTextContent('Há 2 verificações guardadas neste navegador.')
    expect(within(dialog).getByRole('button', { name: 'Agora não' })).toHaveFocus()
    expect(session(storage).historyLinked).toBe(false)
    expect(screen.getByRole('switch', { name: 'Vincular' })).not.toBeChecked()
  })

  it('"Vincular histórico" vincula e avisa', async () => {
    const { storage } = setup({ history: HISTORY })
    await userEvent.click(screen.getByRole('switch', { name: 'Vincular' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vincular histórico' }))
    expect(await screen.findByText('Histórico vinculado à conta.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Vincular' })).toBeChecked())
    expect(session(storage).historyLinked).toBe(true)
    expect(screen.getByText('As próximas verificações ficam ligadas à sua conta.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Agora não" mantém tudo como estava', async () => {
    const { storage } = setup({ history: HISTORY })
    await userEvent.click(screen.getByRole('switch', { name: 'Vincular' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Agora não' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(session(storage).historyLinked).toBe(false)
    expect(screen.getByRole('switch', { name: 'Vincular' })).not.toBeChecked()
  })

  it('desligar desvincula na hora e diz que o histórico continua no navegador', async () => {
    const { storage } = setup({ history: HISTORY, linked: true })
    const toggle = screen.getByRole('switch', { name: 'Vincular' })
    expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    expect(await screen.findByText('Histórico desvinculado: ele continua só neste navegador.')).toBeInTheDocument()
    expect(session(storage).historyLinked).toBe(false)
  })

  it('falha ao vincular: avisa e não altera nada', async () => {
    const { storage } = setup({
      history: HISTORY,
      gateway: (demo) => ({ ...demo, linkHistory: vi.fn().mockRejectedValue(new Error('x')) }),
    })
    await userEvent.click(screen.getByRole('switch', { name: 'Vincular' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vincular histórico' }))
    expect(await screen.findByText('Não foi possível alterar agora. Tente de novo.')).toBeInTheDocument()
    expect(session(storage).historyLinked).toBe(false)
  })
})

describe('histórico dentro da conta', () => {
  it('"Limpar histórico" fica desativado quando não há nada para limpar', () => {
    setup({ history: [] })
    expect(screen.getByRole('button', { name: 'Limpar histórico' })).toBeDisabled()
  })

  it('pede confirmação, apaga só o histórico local e avisa quantas foram', async () => {
    const { services, storage } = setup({ history: HISTORY })
    await userEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }))
    const dialog = await screen.findByRole('dialog', { name: 'Limpar todo o histórico?' })
    expect(dialog).toHaveTextContent('Isso apaga as 2 verificações guardadas neste navegador. Não dá para desfazer.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Limpar histórico' }))
    expect(await screen.findByText('Histórico limpo: 2 verificações apagadas.')).toBeInTheDocument()
    expect(services.history.getSnapshot().items).toEqual([])
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
  })

  it('"Ver histórico" leva à lista', async () => {
    setup()
    await userEvent.click(screen.getByRole('link', { name: 'Ver histórico' }))
    expect(where()).toBe('/historico')
  })
})

describe('RF34: excluir a conta', () => {
  async function openDelete(options) {
    const utils = setup(options)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Excluir a conta?' })
    return { ...utils, dialog }
  }

  it('antes de confirmar, lista o que acontece e o que não acontece, e o foco fica no botão seguro', async () => {
    const { dialog } = await openDelete({ history: HISTORY })
    expect(dialog).toHaveTextContent('O seu acesso é encerrado neste dispositivo.')
    expect(dialog).toHaveTextContent('O histórico guardado só neste navegador não é tocado; você pode limpá-lo à parte.')
    expect(dialog).toHaveTextContent('Não dá para desfazer.')
    expect(dialog).toHaveTextContent('Demonstração: nenhum dado foi enviado a um servidor')
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('cancelar não exclui nada', async () => {
    const { dialog, storage } = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
    expect(where()).toBe('/conta')
  })

  it('confirmar encerra a sessão, avisa e volta ao início', async () => {
    const { dialog, storage } = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir minha conta' }))
    expect(await screen.findByText('Conta excluída. Você saiu.')).toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/'))
    expect(storage.getString(STORAGE_KEYS.demoSession)).toBeNull()
  })

  it('falha ao excluir: diz que nada foi apagado e fica na conta', async () => {
    const { dialog, storage } = await openDelete({
      gateway: (demo) => ({ ...demo, deleteAccount: vi.fn().mockRejectedValue(new Error('x')) }),
    })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir minha conta' }))
    expect(await screen.findByText('Não foi possível excluir a conta agora. Nada foi apagado.')).toBeInTheDocument()
    expect(session(storage)).toEqual({ signedIn: true, historyLinked: false })
    expect(where()).toBe('/conta')
  })
})

describe('acessibilidade (axe)', () => {
  it('com sessão', async () => {
    const { container } = setup({ history: HISTORY })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem sessão', async () => {
    const { container } = setup({ signedIn: false })
    expect(await axe(container)).toHaveNoViolations()
  })
})
