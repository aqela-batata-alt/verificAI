import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

/**
 * Caixa de diálogo modal sobre o elemento <dialog> nativo: o navegador cuida de prender o foco,
 * deixar o resto da página inerte e fechar com Esc (APG, "Dialog (Modal)").
 *
 * - O conteúdo só existe enquanto está aberto (formulários dentro dela começam limpos).
 * - O foco vai para o elemento marcado com data-autofocus (nas ações que apagam algo, o botão
 *   seguro, "Cancelar") ou, se não houver, para o primeiro controle.
 * - Se o conteúdo é mais alto que a janela (celular pequeno, letra ampliada), o foco vai para o
 *   título: focar um botão lá embaixo rolaria a janela e esconderia o começo do texto (APG:
 *   num diálogo longo, o foco inicial vai para um elemento estático no topo).
 * - Ao fechar, o foco volta para quem abriu.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   eyebrow?: string,
 *   actions?: import('react').ReactNode,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function Dialog({ open, onClose, title, eyebrow, actions, children }) {
  const ref = useRef(/** @type {HTMLDialogElement | null} */ (null))
  const opener = useRef(/** @type {Element | null} */ (null))
  const openRef = useRef(open)
  const titleId = useId()

  useEffect(() => {
    openRef.current = open
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      opener.current = document.activeElement
      dialog.showModal()
      const preferred = dialog.querySelector('[data-autofocus]')
      const heading = dialog.querySelector('.dialog__title')
      const overflows = dialog.scrollHeight > dialog.clientHeight
      if (overflows && heading instanceof HTMLElement) heading.focus()
      else if (preferred instanceof HTMLElement) preferred.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Se o componente sair da tela com o diálogo aberto, o foco volta para quem abriu.
  useEffect(
    () => () => {
      const dialog = ref.current
      if (dialog?.open) dialog.close()
    },
    [],
  )

  function handleClose() {
    // O evento "close" também dispara quando o código fecha o diálogo: só avisa o pai se foi o navegador.
    if (openRef.current) onClose()
    const previous = opener.current
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
  }

  return (
    // O clique no fundo escuro fecha o diálogo; o teclado fecha com Esc (evento "cancel").
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open ? (
        <div className="dialog__panel">
          {eyebrow ? <p className="dialog__eyebrow">{eyebrow}</p> : null}
          <div className="dialog__top">
            <h2 id={titleId} className="dialog__title" tabIndex={-1}>
              {title}
            </h2>
            <button type="button" className="icon-btn" aria-label="Fechar janela" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <div className="dialog__body">{children}</div>
          {actions ? <div className="dialog__actions">{actions}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}
