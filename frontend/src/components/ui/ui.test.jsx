import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { STATUS_CODES, STATUS_INFO } from '../../domain/status.js'
import { ToastProvider, useToast } from '../../state/toast.jsx'
import Button from './Button.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import Dialog from './Dialog.jsx'
import Disclosure from './Disclosure.jsx'
import { CheckboxField, PasswordField, SwitchField, TextAreaField, TextField } from './Field.jsx'
import Notice from './Notice.jsx'
import StatusBadge from './StatusBadge.jsx'
import Tabs from './Tabs.jsx'

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Button', () => {
  it('é um <button type="button"> por padrão (nunca envia formulário sem querer)', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button')
  })

  it('com "to" vira link interno; com "href" e "external" abre em nova aba e avisa isso', () => {
    inRouter(
      <>
        <Button to="/historico">Histórico</Button>
        <Button href="https://exemplo.org/x" external>
          Fonte
        </Button>
      </>,
    )
    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute('href', '/historico')
    const external = screen.getByRole('link', { name: /Fonte/ })
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', 'noopener noreferrer')
    expect(external).toHaveAccessibleName(/^Fonte\s*\(abre em uma nova aba\)$/)
  })

  it('desabilitado não dispara o clique', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Enviar
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('campos de formulário', () => {
  it('rótulo, dica e erro ficam ligados ao campo (aria-describedby) e o erro é escrito', () => {
    render(<TextField label="E-mail" hint="Use o e-mail da conta" error="Informe um e-mail válido." />)
    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Use o e-mail da conta Informe um e-mail válido.')
  })

  it('sem erro, o campo não é marcado como inválido', () => {
    render(<TextField label="E-mail" />)
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid')
  })

  it('a área de texto não limita a digitação por "maxlength" (RF01: nada é cortado em silêncio)', () => {
    render(<TextAreaField label="Texto" hint="Entre 50 e 5.000 caracteres" />)
    expect(screen.getByLabelText('Texto')).not.toHaveAttribute('maxlength')
  })

  it('permite colar em qualquer campo, inclusive senha (WCAG 3.3.8)', async () => {
    render(<PasswordField label="Senha" />)
    const input = screen.getByLabelText('Senha')
    await userEvent.click(input)
    await userEvent.paste('senha-colada-123')
    expect(input).toHaveValue('senha-colada-123')
  })

  it('senha: o botão mantém o nome e o estado muda em aria-pressed', async () => {
    render(<PasswordField label="Senha" />)
    const input = screen.getByLabelText('Senha')
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(input).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('caixa de seleção: clicar no texto marca a caixa', async () => {
    render(<CheckboxField>Li a política</CheckboxField>)
    await userEvent.click(screen.getByText('Li a política'))
    expect(screen.getByRole('checkbox', { name: 'Li a política' })).toBeChecked()
  })

  it('chave liga/desliga: papel "switch", estado escrito e nome acessível só com o rótulo', async () => {
    function Harness() {
      const [on, setOn] = useState(true)
      return <SwitchField label="Guardar o histórico" checked={on} onChange={setOn} />
    }
    render(<Harness />)
    const toggle = screen.getByRole('switch', { name: 'Guardar o histórico' })
    expect(toggle).toBeChecked()
    expect(screen.getByText('Ligado')).toBeInTheDocument()
    await userEvent.click(toggle)
    expect(screen.getByRole('switch', { name: 'Guardar o histórico' })).not.toBeChecked()
    expect(screen.getByText('Desligado')).toBeInTheDocument()
  })
})

describe('Tabs (APG: Tabs)', () => {
  const tabs = [
    { id: 'text', label: 'Colar texto' },
    { id: 'url', label: 'Inserir link' },
    { id: 'file', label: 'Arquivo' },
  ]

  function Harness({ items = tabs, initial = 'text', onChange = () => {} }) {
    const [value, setValue] = useState(initial)
    return (
      <Tabs
        label="Formato"
        idPrefix="t"
        value={value}
        tabs={items}
        onChange={(id) => {
          onChange(id)
          setValue(id)
        }}
      />
    )
  }

  it('só a aba selecionada entra na ordem do Tab e aponta para o painel', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Formato' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Colar texto' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Colar texto' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Colar texto' })).toHaveAttribute('aria-controls', 't-painel')
    expect(screen.getByRole('tab', { name: 'Inserir link' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'Inserir link' })).not.toHaveAttribute('aria-controls')
  })

  it('setas, Home e End movem o foco e selecionam (com volta do fim ao começo)', async () => {
    render(<Harness />)
    screen.getByRole('tab', { name: 'Colar texto' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Inserir link' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Inserir link' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Arquivo' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Colar texto' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Arquivo' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Colar texto' })).toHaveFocus()
  })

  it('aba indisponível recebe foco (para a explicação ser lida), mas não pode ser selecionada', async () => {
    const onChange = vi.fn()
    render(
      <Harness
        onChange={onChange}
        items={[
          { id: 'text', label: 'Colar texto' },
          { id: 'url', label: 'Inserir link', disabled: true, badge: 'Em breve' },
        ]}
      />,
    )
    const disabled = screen.getByRole('tab', { name: /Inserir link/ })
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(disabled)
    expect(onChange).not.toHaveBeenCalled()
    screen.getByRole('tab', { name: 'Colar texto' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(disabled).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Colar texto' })).toHaveAttribute('aria-selected', 'true')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Dialog (APG: Dialog Modal)', () => {
  function Harness({ onClosed = () => {} }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        <Dialog
          open={open}
          onClose={() => {
            onClosed()
            setOpen(false)
          }}
          title="Título do diálogo"
          eyebrow="Contexto"
          actions={
            <>
              <Button data-autofocus onClick={() => setOpen(false)}>
                Seguro
              </Button>
              <Button>Outro</Button>
            </>
          }
        >
          <p>Conteúdo</p>
        </Dialog>
      </>
    )
  }

  it('o conteúdo só existe enquanto o diálogo está aberto', async () => {
    render(<Harness />)
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('dialog', { name: 'Título do diálogo' })).toBeInTheDocument()
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
  })

  it('o foco vai para o elemento marcado com data-autofocus e volta a quem abriu', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(opener)
    expect(screen.getByRole('button', { name: 'Seguro' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Seguro' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  describe('conteúdo mais alto que a janela (celular pequeno, letra ampliada)', () => {
    // O jsdom não tem layout: simula a medida que o navegador daria.
    function overflowing() {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    }

    it('o foco vai para o título, para o começo do texto não sair da tela', async () => {
      overflowing()
      render(<Harness />)
      await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
      const title = screen.getByRole('heading', { name: 'Título do diálogo' })
      expect(title).toHaveFocus()
      expect(title).toHaveAttribute('tabindex', '-1')
      expect(screen.getByRole('button', { name: 'Seguro' })).not.toHaveFocus()
    })

    it('Tab leva ao primeiro controle e o diálogo continua fechando normalmente', async () => {
      overflowing()
      const onClosed = vi.fn()
      render(<Harness onClosed={onClosed} />)
      const opener = screen.getByRole('button', { name: 'Abrir' })
      await userEvent.click(opener)
      await userEvent.tab()
      expect(screen.getByRole('button', { name: 'Fechar janela' })).toHaveFocus()
      await userEvent.click(screen.getByRole('button', { name: 'Seguro' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(opener).toHaveFocus()
    })

    it('com o conteúdo cabendo na janela, o botão seguro continua recebendo o foco', async () => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
      render(<Harness />)
      await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
      expect(screen.getByRole('button', { name: 'Seguro' })).toHaveFocus()
    })
  })

  it('Esc (evento "cancel") avisa o pai e não fecha por conta própria', async () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    const event = new Event('cancel', { cancelable: true })
    act(() => {
      dialog.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('o botão "Fechar janela" e o clique no fundo fecham', async () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar janela' }))
    expect(onClosed).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClosed).toHaveBeenCalledTimes(2)
  })

  it('não tem violações de acessibilidade (axe)', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ConfirmDialog', () => {
  it('o botão seguro ("Cancelar") recebe o foco e a confirmação só acontece no botão de ação', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open title="Limpar tudo?" confirmLabel="Limpar" onConfirm={onConfirm} onCancel={onCancel}>
        <p>Isso não pode ser desfeito.</p>
      </ConfirmDialog>,
    )
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('ocupado: a confirmação fica desabilitada (sem clique duplo)', () => {
    render(<ConfirmDialog open busy title="Excluir?" confirmLabel="Excluir" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })
})

describe('Notice, StatusBadge e Disclosure', () => {
  it('o aviso traz ícone e texto; o papel só existe quando pedido', () => {
    const { container } = render(
      <>
        <Notice tone="warning">Atenção ao prazo.</Notice>
        <Notice tone="error" role="alert">
          Falhou.
        </Notice>
      </>,
    )
    expect(container.querySelectorAll('svg')).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(STATUS_CODES)('o selo de %s tem texto e ícone próprio (a cor não é o único sinal)', (code) => {
    const { container } = render(<StatusBadge code={code} />)
    expect(screen.getByText(STATUS_INFO[code].label)).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('o selo curto usa o rótulo curto', () => {
    render(<StatusBadge code="poucos_sinais_de_risco" short />)
    expect(screen.getByText('Pouco risco')).toBeInTheDocument()
  })

  it('o bloco que abre e fecha começa fechado e o resumo (nativo) o abre e fecha', async () => {
    const { container } = render(
      <Disclosure title="Detalhes técnicos">
        <p>Conteúdo escondido</p>
      </Disclosure>,
    )
    const details = container.querySelector('details')
    const summary = screen.getByText('Detalhes técnicos').closest('summary')
    expect(details).not.toHaveAttribute('open')
    await userEvent.click(summary)
    expect(details).toHaveAttribute('open')
    await userEvent.click(summary)
    expect(details).not.toHaveAttribute('open')
  })

  it('pode começar aberto', () => {
    const { container } = render(
      <Disclosure title="Perguntas" defaultOpen>
        <p>Resposta</p>
      </Disclosure>,
    )
    expect(container.querySelector('details')).toHaveAttribute('open')
  })
})

describe('avisos (toast)', () => {
  function Probe({ options }) {
    const toast = useToast()
    return <button onClick={() => toast.show(options)}>mostrar</button>
  }

  it('aviso com ação: o botão executa a ação e fecha o aviso', async () => {
    const onAction = vi.fn()
    render(
      <MemoryRouter>
        <ToastProvider>
          <Probe options={{ message: 'Item excluído.', action: { label: 'Desfazer', onAction } }} />
        </ToastProvider>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'mostrar' }))
    expect(screen.getByText('Item excluído.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Item excluído.')).not.toBeInTheDocument()
  })

  it('erro vai para a região assertiva; o resto, para a educada', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Probe options={{ message: 'Falhou.', tone: 'error' }} />
        </ToastProvider>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'mostrar' }))
    expect(within(screen.getByRole('alert')).getByText('Falhou.')).toBeInTheDocument()
  })

  it('o aviso pode ser fechado pelo botão "Fechar aviso"', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Probe options={{ message: 'Pronto.', tone: 'success' }} />
        </ToastProvider>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'mostrar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByText('Pronto.')).not.toBeInTheDocument()
  })

  it('nenhum aviso some sozinho em poucos segundos', () => {
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter>
          <ToastProvider>
            <Probe options={{ message: 'Fica um tempo.' }} />
          </ToastProvider>
        </MemoryRouter>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'mostrar' }))
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(screen.getByText('Fica um tempo.')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('acessibilidade dos campos (axe)', () => {
  it('formulário com erro, dica e chave não tem violações', async () => {
    const { container } = render(
      <form aria-label="Exemplo">
        <TextField label="E-mail" hint="Use o e-mail da conta" error="Informe um e-mail válido." />
        <PasswordField label="Senha" hint="Pelo menos 8 caracteres" />
        <TextAreaField label="Comentário" hint="Opcional" />
        <CheckboxField>Aceito</CheckboxField>
        <SwitchField label="Guardar histórico" checked onChange={() => {}} />
      </form>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
