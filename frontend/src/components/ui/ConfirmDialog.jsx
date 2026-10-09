import Button from './Button.jsx'
import Dialog from './Dialog.jsx'

/**
 * Pedido de confirmação para ações que não têm "desfazer" (apagar tudo, excluir a conta).
 * O botão seguro ("Cancelar") recebe o foco primeiro, para que apertar Enter sem pensar não
 * apague nada (Nielsen: prevenção de erros). Ações de um item só usam "desfazer" no lugar de
 * confirmação (Aza Raskin, "Never use a warning when you mean undo").
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   eyebrow?: string,
 *   confirmLabel: string,
 *   cancelLabel?: string,
 *   tone?: 'danger' | 'gold',
 *   busy?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function ConfirmDialog({
  open,
  title,
  eyebrow,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      eyebrow={eyebrow}
      actions={
        <>
          <Button variant="outline" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
