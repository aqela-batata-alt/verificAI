import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { createStorage, STORAGE_KEYS } from '../services/storage.js'
import { createTestServices, renderWithApp } from '../test/render.jsx'
import HistoryPage from './HistoryPage.jsx'

// RF20 (histórico local: alegação resumida, status, data; excluir; limpar; opcional),
// RF28 (vínculo com a conta) e o padrão "desfazer em vez de confirmar" (Aza Raskin).

const ITEMS = [
  { id: 'a1', claim: 'Todas as linhas de ônibus deixarão de funcionar no domingo.', status: 'requer_atencao', createdAt: '2026-10-08T11:53:00Z', inputType: 'text' },
  { id: 'a2', claim: 'Biblioteca municipal anuncia programação de leitura.', status: 'poucos_sinais_de_risco', createdAt: '2026-10-07T09:10:00Z', inputType: 'text' },
  { id: 'a3', claim: 'Órgão público confirma pagamento de R$ 5.000 amanhã.', status: 'alto_risco', createdAt: '2026-10-06T22:00:00Z', inputType: 'url' },
  { id: 'a4', claim: 'Ouvi dizer que a praça será fechada para obras.', status: 'analise_inconclusiva', createdAt: '2026-10-05T15:00:00Z', inputType: 'text' },
]

function setup({ items = ITEMS, enabled = true, signedIn = false, env, storage } = {}) {
  const services = createTestServices({ env, storage })
  if (!enabled) services.history.setEnabled(false)
  for (const item of [...items].reverse()) services.history.add(item)
  // "add" respeita a chave desligada; para o teste de histórico desligado com itens, grava direto.
  if (!enabled && items.length) services.storage.setJSON(STORAGE_KEYS.history, items)
  if (signedIn) services.auth?.signIn({ email: 'a@b.co', password: 'senha-de-teste-1' })
  const utils = renderWithApp(
    <Routes>
      <Route path="/historico" element={<HistoryPage />} />
      <Route path="/resultado/:id" element={<p>RESULTADO</p>} />
      <Route path="/" element={<p>INÍCIO</p>} />
    </Routes>,
    { route: '/historico', services },
  )
  return { services, ...utils }
}

const rows = () => screen.getAllByRole('listitem').filter((li) => li.classList.contains('history-row'))
const openLinks = () => screen.getAllByRole('link', { name: /^Abrir/ })

describe('lista (RF20)', () => {
  it('mostra, em cada linha, a alegação resumida, o resultado em texto, a data e a origem', () => {
    setup()
    expect(rows()).toHaveLength(4)
    const first = rows()[0]
    expect(first).toHaveTextContent('Todas as linhas de ônibus deixarão de funcionar no domingo.')
    expect(first).toHaveTextContent('Atenção')
    expect(first).toHaveTextContent('08 de out. · 08:53')
    expect(first).toHaveTextContent('Texto colado')
    expect(rows()[2]).toHaveTextContent('Link')
    expect(rows().map((row) => row.querySelector('.pill').textContent)).toEqual(['Atenção', 'Pouco risco', 'Alto risco', 'Inconclusivo'])
  })

  it('"Abrir" leva ao resultado pelo identificador e diz, no nome do link, qual verificação abre', async () => {
    setup()
    const link = screen.getByRole('link', { name: /Abrir: Biblioteca municipal/ })
    expect(link).toHaveAttribute('href', '/resultado/a2')
    await userEvent.click(link)
    expect(screen.getByText('RESULTADO')).toBeInTheDocument()
  })

  it('só guarda alegação, status, data, origem e identificador: nunca o texto integral', () => {
    const { services } = setup()
    const stored = JSON.parse(services.storage.getString(STORAGE_KEYS.history))
    for (const entry of stored) {
      expect(Object.keys(entry).sort()).toEqual(['claim', 'createdAt', 'id', 'inputType', 'status'])
    }
  })

  it('conta no singular e no plural', () => {
    setup({ items: [ITEMS[0]] })
    expect(screen.getByText('1 verificação guardada.')).toBeInTheDocument()
  })

  it('o contador é uma região "status" (a mudança é anunciada)', () => {
    setup()
    expect(screen.getByText('4 verificações guardadas.')).toHaveAttribute('role', 'status')
  })
})

describe('estados vazios', () => {
  it('sem nada guardado: explica e leva a uma verificação', async () => {
    setup({ items: [] })
    expect(screen.getByRole('heading', { name: 'Nada guardado por aqui ainda.' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Verificar uma notícia/ }))
    expect(screen.getByText('INÍCIO')).toBeInTheDocument()
  })

  it('histórico desligado e vazio: diz que está desligado e como ligar', () => {
    setup({ items: [], enabled: false })
    expect(screen.getByRole('heading', { name: 'O histórico está desligado.' })).toBeInTheDocument()
    expect(screen.getByText('Ligue a chave acima para guardar as próximas verificações neste navegador.')).toBeInTheDocument()
  })

  it('sem itens, não mostra "Limpar histórico", filtros nem busca', () => {
    setup({ items: [] })
    expect(screen.queryByRole('button', { name: 'Limpar histórico' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar por resultado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})

describe('excluir um item: desfazer em vez de confirmar', () => {
  it('a linha some na hora e o aviso oferece "Desfazer"', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Excluir do histórico: Biblioteca municipal/ }))
    expect(rows()).toHaveLength(3)
    expect(screen.queryByText(/Biblioteca municipal/)).not.toBeInTheDocument()
    expect(screen.getByText('Verificação excluída do histórico.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument()
  })

  it('não abre janela de confirmação para um item só', async () => {
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: /Excluir do histórico/ })[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Desfazer" devolve o item à mesma posição', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Excluir do histórico: Biblioteca municipal/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(rows()).toHaveLength(4)
    expect(rows()[1]).toHaveTextContent('Biblioteca municipal')
  })

  it('o foco vai para a próxima linha, e não volta ao topo da página', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Excluir do histórico: Biblioteca municipal/ }))
    await waitFor(() => expect(openLinks()[1]).toHaveFocus())
    expect(openLinks()[1]).toHaveAccessibleName(/Órgão público/)
  })

  it('excluindo a última linha da lista, o foco vai para a anterior', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Excluir do histórico: Ouvi dizer/ }))
    await waitFor(() => expect(openLinks()[2]).toHaveFocus())
  })

  it('excluindo o único item, o foco vai para o estado vazio', async () => {
    setup({ items: [ITEMS[0]] })
    await userEvent.click(screen.getByRole('button', { name: /Excluir do histórico/ }))
    const empty = screen.getByRole('heading', { name: 'Nada guardado por aqui ainda.' }).closest('.empty-state')
    await waitFor(() => expect(empty).toHaveFocus())
  })

  it('a exclusão vale no armazenamento do navegador', async () => {
    const { services } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Excluir do histórico: Biblioteca municipal/ }))
    const stored = JSON.parse(services.storage.getString(STORAGE_KEYS.history))
    expect(stored.map((item) => item.id)).toEqual(['a1', 'a3', 'a4'])
  })
})

describe('limpar tudo: pede confirmação', () => {
  it('abre a janela com o botão seguro em foco e diz o que será apagado', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }))
    const dialog = await screen.findByRole('dialog', { name: 'Limpar todo o histórico?' })
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(dialog).toHaveTextContent('Isso apaga as 4 verificações guardadas neste navegador. Não dá para desfazer.')
  })

  it('RF30: a janela é honesta — o registro técnico no servidor não é apagado por aqui', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('O registro técnico de cada análise, que não inclui o texto enviado, continua no servidor')
  })

  it('cancelar não apaga nada', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(rows()).toHaveLength(4)
  })

  it('Esc também cancela (o navegador dispara o evento "cancel" do <dialog> nativo)', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }))
    const dialog = await screen.findByRole('dialog')
    // O jsdom não traduz a tecla Esc em "cancel"; o navegador de verdade traduz (conferido no navegador real).
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rows()).toHaveLength(4)
  })

  it('confirmar apaga tudo, avisa quantas foram e leva o foco ao estado vazio', async () => {
    const { services } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar histórico' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Limpar histórico' }))
    expect(await screen.findByText('Histórico limpo: 4 verificações apagadas.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nada guardado por aqui ainda.' })).toBeInTheDocument()
    expect(JSON.parse(services.storage.getString(STORAGE_KEYS.history))).toEqual([])
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nada guardado por aqui ainda.' }).closest('.empty-state')).toHaveFocus())
  })
})

describe('filtrar e buscar', () => {
  it('filtra por resultado e diz quantas verificações aparecem', async () => {
    setup()
    const group = screen.getByRole('group', { name: 'Filtrar por resultado' })
    expect(within(group).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(group).getByRole('button', { name: 'Alto risco' }))
    expect(within(group).getByRole('button', { name: 'Alto risco' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false')
    expect(rows()).toHaveLength(1)
    expect(screen.getByText('Mostrando 1 de 4 verificações.')).toBeInTheDocument()
  })

  it('busca por palavra sem diferenciar maiúsculas nem acentos', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Pesquisar no histórico' }), 'ONIBUS')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('linhas de ônibus')
  })

  it('sem resultado: explica e "Limpar filtros" volta à lista inteira', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Pesquisar no histórico' }), 'xyzxyz')
    expect(screen.getByRole('heading', { name: 'Nenhuma verificação com esse filtro.' })).toBeInTheDocument()
    expect(screen.getByText('Mostrando 0 de 4 verificações.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(rows()).toHaveLength(4)
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(within(screen.getByRole('group', { name: 'Filtrar por resultado' })).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('o filtro não altera nem apaga o que está guardado', async () => {
    const { services } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Alto risco' }))
    expect(JSON.parse(services.storage.getString(STORAGE_KEYS.history))).toHaveLength(4)
  })
})

describe('RF20: o histórico é opcional', () => {
  it('a chave começa ligada e desligar grava a escolha, sem apagar o que já existe', async () => {
    const { services } = setup()
    const toggle = screen.getByRole('switch', { name: 'Guardar o histórico neste navegador' })
    expect(toggle).toBeChecked()
    expect(screen.getByText('As próximas verificações aparecem aqui.')).toBeInTheDocument()
    await userEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(services.storage.getString(STORAGE_KEYS.historyEnabled)).toBe('false')
    expect(screen.getByText(/Desligado: as próximas verificações não serão guardadas\. O que já está aqui continua até você apagar\./)).toBeInTheDocument()
    expect(rows()).toHaveLength(4)
    expect(toggle).toHaveAccessibleDescription(/Desligado/)
  })

  it('com a chave desligada, novas análises não entram no histórico', () => {
    const { services } = setup({ enabled: false, items: [] })
    expect(services.history.add(ITEMS[0])).toBe(false)
    expect(services.history.getSnapshot().items).toEqual([])
  })

  it('o estado escrito ("Ligado"/"Desligado") acompanha a chave', async () => {
    setup()
    const label = screen.getByRole('switch').closest('label')
    expect(label).toHaveTextContent('Ligado')
    await userEvent.click(screen.getByRole('switch'))
    expect(label).toHaveTextContent('Desligado')
  })
})

describe('navegador sem armazenamento', () => {
  it('avisa que o histórico só vale enquanto a página estiver aberta', () => {
    setup({ storage: createStorage({ backend: null }), items: [] })
    expect(screen.getByText(/Este navegador não deixa guardar o histórico/)).toBeInTheDocument()
  })

  it('com armazenamento, o aviso não aparece', () => {
    setup()
    expect(screen.queryByText(/Este navegador não deixa guardar o histórico/)).not.toBeInTheDocument()
  })
})

describe('faixa de conta (RF28)', () => {
  it('visitante: diz que o histórico fica só no navegador e oferece "Entrar"', () => {
    setup()
    expect(screen.getByText('Seu histórico fica só neste navegador.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Entrar/ })).toHaveAttribute('href', '/entrar')
  })

  it('contas desligadas na configuração: não oferece entrar', () => {
    setup({ env: { VITE_ACCOUNTS_MODE: 'off' } })
    expect(screen.queryByRole('link', { name: /Entrar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Seu histórico fica só neste navegador.')).toBeInTheDocument()
  })

  it('conta de demonstração: não finge sincronizar', async () => {
    const { services } = setup()
    await act(async () => {
      await services.auth.signIn({ email: 'a@b.co', password: 'senha-de-teste-1' })
    })
    expect(await screen.findByText('Você está numa conta de demonstração.')).toBeInTheDocument()
    expect(screen.getByText(/A sincronização é simulada: esta versão não usa servidor, e o histórico continua só neste navegador\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Minha conta/ })).toHaveAttribute('href', '/conta')
  })
})

describe('acessibilidade (axe)', () => {
  it('com itens', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('vazio', async () => {
    const { container } = setup({ items: [] })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sem resultado para o filtro', async () => {
    const { container } = setup()
    await userEvent.type(screen.getByRole('searchbox'), 'xyzxyz')
    expect(await axe(container)).toHaveNoViolations()
  })
})
