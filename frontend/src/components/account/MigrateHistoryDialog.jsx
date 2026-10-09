import { useAuth } from '../../hooks/useAuth.js'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Notice from '../ui/Notice.jsx'

/**
 * Pergunta se o histórico guardado neste navegador deve ser vinculado à conta (RF28). Nada é
 * vinculado sem a resposta explícita "Vincular": fechar a janela, Esc e "Agora não" mantêm o
 * histórico só neste navegador. O botão seguro é o que recebe o foco.
 *
 * @param {{
 *   open: boolean,
 *   count: number,
 *   busy?: boolean,
 *   onLink: () => void,
 *   onKeepLocal: () => void,
 * }} props
 */
export default function MigrateHistoryDialog({ open, count, busy = false, onLink, onKeepLocal }) {
  const { mode } = useAuth()
  return (
    <Dialog
      open={open}
      onClose={onKeepLocal}
      eyebrow="Seu histórico"
      title="Vincular o histórico à sua conta?"
      actions={
        <>
          <Button variant="outline" onClick={onKeepLocal} data-autofocus>
            Agora não
          </Button>
          <Button variant="gold" onClick={onLink} disabled={busy}>
            Vincular histórico
          </Button>
        </>
      }
    >
      <p>
        Há {count === 1 ? '1 verificação guardada' : `${count} verificações guardadas`} neste navegador. Se você
        vincular, elas passam a fazer parte da sua conta.
      </p>
      <p>Se escolher &quot;Agora não&quot;, nada é enviado à conta e o histórico continua só neste navegador.</p>
      {mode === 'demo' ? (
        <Notice tone="info">Demonstração: a escolha fica marcada neste navegador e nada é enviado a um servidor.</Notice>
      ) : null}
    </Dialog>
  )
}
