import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { createDemoAuthGateway } from '../services/gateways.js'
import { createStorage } from '../services/storage.js'
import { createTestServices, renderWithApp } from '../test/render.jsx'
import RecoveryPage from './RecoveryPage.jsx'

// RF32: recuperar o acesso sem revelar quem tem conta.

function setup({ gateway } = {}) {
  const storage = createStorage()
  const demo = createDemoAuthGateway({ storage })
  const auth = gateway ? gateway(demo) : demo
  const services = createTestServices({ storage, auth })
  return renderWithApp(
    <Routes>
      <Route path="/recuperar-acesso" element={<RecoveryPage />} />
      <Route path="/entrar" element={<p>ENTRAR</p>} />
    </Routes>,
    { route: '/recuperar-acesso', services },
  )
}

const email = () => screen.getByLabelText('E-mail da conta')
const send = () => screen.getByRole('button', { name: 'Enviar instruções' })

describe('recuperar o acesso (RF32)', () => {
  it('pede só o e-mail, explica o que vai acontecer e avisa que na demonstração nada é enviado', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Uma nova senha.')
    expect(screen.getByText('Informe o e-mail usado na conta para receber as instruções de recuperação.')).toBeInTheDocument()
    expect(screen.getByText('Fluxo simulado: esta versão não envia mensagens.')).toBeInTheDocument()
    expect(email()).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByRole('link', { name: /Voltar para o acesso/ })).toHaveAttribute('href', '/entrar')
  })

  it('e-mail vazio ou inválido: escreve o problema e leva o foco ao campo', async () => {
    setup()
    await userEvent.click(send())
    expect(screen.getByText('Informe o seu e-mail.')).toBeInTheDocument()
    expect(email()).toHaveFocus()
    await userEvent.type(email(), 'sem-arroba')
    await userEvent.click(send())
    expect(screen.getByText(/Esse e-mail não parece válido/)).toBeInTheDocument()
  })

  it('a resposta é a mesma para qualquer e-mail (não revela quem tem conta)', async () => {
    const requestRecovery = vi.fn(async () => {})
    setup({ gateway: (demo) => ({ ...demo, requestRecovery }) })
    await userEvent.type(email(), 'qualquer@exemplo.com')
    await userEvent.click(send())
    expect(await screen.findByRole('heading', { level: 1, name: 'Confira o seu e-mail.' })).toBeInTheDocument()
    expect(screen.getByText(/Se houver uma conta com esse e-mail, enviaremos as instruções/)).toBeInTheDocument()
    expect(screen.getByText(/A resposta é a mesma para qualquer e-mail/)).toBeInTheDocument()
    expect(requestRecovery).toHaveBeenCalledWith({ email: 'qualquer@exemplo.com' })
    expect(screen.queryByText('qualquer@exemplo.com')).not.toBeInTheDocument()
  })

  it('o e-mail digitado é enviado sem espaços nas pontas', async () => {
    const requestRecovery = vi.fn(async () => {})
    setup({ gateway: (demo) => ({ ...demo, requestRecovery }) })
    await userEvent.type(email(), '  maria@exemplo.com  ')
    await userEvent.click(send())
    await screen.findByRole('heading', { name: 'Confira o seu e-mail.' })
    expect(requestRecovery).toHaveBeenCalledWith({ email: 'maria@exemplo.com' })
  })

  it('ao confirmar, o foco vai para o título novo (o botão que a pessoa apertou saiu da tela)', async () => {
    setup()
    await userEvent.type(email(), 'maria@exemplo.com')
    await userEvent.click(send())
    const heading = await screen.findByRole('heading', { level: 1, name: 'Confira o seu e-mail.' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('na confirmação, na demonstração, repete que nenhuma mensagem foi enviada', async () => {
    setup()
    await userEvent.type(email(), 'maria@exemplo.com')
    await userEvent.click(send())
    await screen.findByRole('heading', { name: 'Confira o seu e-mail.' })
    expect(screen.getByText('Fluxo simulado: esta versão não envia mensagens.')).toBeInTheDocument()
    // Dois links com o mesmo nome e o mesmo destino (o do topo e o do fim da mensagem): não confunde.
    const links = screen.getAllByRole('link', { name: /Voltar para o acesso/ })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', '/entrar')
  })

  it('falha ao enviar: avisa, mantém o e-mail e deixa tentar de novo', async () => {
    const requestRecovery = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined)
    setup({ gateway: (demo) => ({ ...demo, requestRecovery }) })
    await userEvent.type(email(), 'maria@exemplo.com')
    await userEvent.click(send())
    expect(await screen.findByText('Não foi possível enviar agora. Tente de novo em instantes.')).toBeInTheDocument()
    expect(email()).toHaveValue('maria@exemplo.com')
    await userEvent.click(send())
    expect(await screen.findByRole('heading', { name: 'Confira o seu e-mail.' })).toBeInTheDocument()
  })

  it('não tem violações de acessibilidade (axe), antes e depois do envio', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
    await userEvent.type(email(), 'maria@exemplo.com')
    await userEvent.click(send())
    await screen.findByRole('heading', { name: 'Confira o seu e-mail.' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
