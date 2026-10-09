import { formatRemaining, formatRenewal } from '../../domain/format.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useVisitorLimit } from '../../hooks/useVisitorLimit.js'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Notice from '../ui/Notice.jsx'

/**
 * Aviso da quarta tentativa de um visitante (RF33): a análise não começa e a pessoa vê as duas
 * saídas — cadastro e login — e quando o uso como visitante será liberado de novo.
 *
 * Sem contas disponíveis (accountsMode=off), só resta esperar, e o texto diz isso.
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function LimitDialog({ open, onClose }) {
  const { available, mode } = useAuth()
  const { max, renewsAt, msUntilRenewal } = useVisitorLimit()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Limite de visitante"
      title="Você chegou ao limite de análises."
      actions={
        <>
          <Button variant="outline" onClick={onClose} data-autofocus>
            Agora não
          </Button>
          {available ? (
            <>
              <Button variant="outline" to="/entrar" onClick={onClose}>
                Entrar
              </Button>
              <Button variant="gold" to="/criar-conta" iconEnd="arrow" onClick={onClose}>
                Criar conta
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <p>Sem conta, cada navegador pode fazer {max} análises a cada 24 horas.</p>
      {renewsAt !== null && msUntilRenewal !== null ? (
        <p>
          O uso como visitante será liberado de novo em <strong>{formatRenewal(renewsAt)}</strong> (daqui a{' '}
          {formatRemaining(msUntilRenewal)}).
        </p>
      ) : null}
      {available ? (
        <p>Para continuar agora, entre ou crie uma conta.</p>
      ) : (
        <p>Não há como criar conta nesta versão. Volte quando o prazo acabar.</p>
      )}
      {available && mode === 'demo' ? (
        <Notice tone="info">Nesta versão de demonstração a conta é simulada: nada é enviado a um servidor.</Notice>
      ) : null}
    </Dialog>
  )
}
