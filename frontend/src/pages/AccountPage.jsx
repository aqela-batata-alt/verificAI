import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import MigrateHistoryDialog from '../components/account/MigrateHistoryDialog.jsx'
import PageHeading from '../components/layout/PageHeading.jsx'
import Button from '../components/ui/Button.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { SwitchField } from '../components/ui/Field.jsx'
import Notice from '../components/ui/Notice.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useHistory } from '../hooks/useHistory.js'
import { useToast } from '../state/toast.jsx'

// Minha conta (RF28, RF31, RF34).
//  - Sem sessão, a página não mostra nada da conta nem do histórico vinculado (RF32).
//  - Vincular o histórico deste navegador à conta só acontece depois da confirmação (RF28).
//  - Excluir a conta explica o efeito antes de pedir a confirmação (RF34).

export default function AccountPage() {
  useDocumentTitle('Minha conta')
  const auth = useAuth()
  const { items, clear } = useHistory()
  const navigate = useNavigate()
  const toast = useToast()

  const [migrateOpen, setMigrateOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!auth.signedIn) {
    return (
      <div className="wrap screen appear">
        <PageHeading
          eyebrow="Sua conta, seu controle"
          title="Minha conta"
          lead="Entre para ver o histórico vinculado e os controles da conta."
        />
        <section className="sheet empty-state">
          <h2>Acesse sua conta.</h2>
          <p>Você não precisa de conta para verificar um conteúdo. Ela serve para guardar o histórico e continuar depois do limite de visitante.</p>
          <div className="cluster">
            <Button to="/entrar" variant="gold" iconEnd="arrow">
              Entrar
            </Button>
            <Button to="/criar-conta" variant="outline">
              Criar conta
            </Button>
          </div>
        </section>
      </div>
    )
  }

  const demo = auth.mode === 'demo'

  async function signOut() {
    try {
      await auth.signOut?.()
      toast.show({ message: 'Você saiu da conta.', tone: 'success' })
      navigate('/')
    } catch {
      toast.show({ message: 'Não foi possível sair agora. Tente de novo.', tone: 'error' })
    }
  }

  async function linkHistory(/** @type {boolean} */ link) {
    setBusy(true)
    try {
      await auth.linkHistory?.(link)
      toast.show({
        message: link ? 'Histórico vinculado à conta.' : 'Histórico desvinculado: ele continua só neste navegador.',
        tone: 'success',
      })
    } catch {
      toast.show({ message: 'Não foi possível alterar agora. Tente de novo.', tone: 'error' })
    } finally {
      setBusy(false)
      setMigrateOpen(false)
    }
  }

  function clearHistory() {
    const total = items.length
    clear()
    setClearOpen(false)
    toast.show({
      message: total === 1 ? 'Histórico limpo: 1 verificação apagada.' : `Histórico limpo: ${total} verificações apagadas.`,
      tone: 'success',
    })
  }

  async function deleteAccount() {
    setBusy(true)
    try {
      await auth.deleteAccount?.()
      setDeleteOpen(false)
      toast.show({ message: 'Conta excluída. Você saiu.', tone: 'success', persistent: true })
      navigate('/')
    } catch {
      setBusy(false)
      toast.show({ message: 'Não foi possível excluir a conta agora. Nada foi apagado.', tone: 'error' })
    }
  }

  return (
    <div className="wrap screen appear">
      <PageHeading
        eyebrow="Sua conta, seu controle"
        title="Seus dados. Suas escolhas."
        lead="Gerencie o histórico e o seu acesso ao Apura."
      />

      <div className="account-grid">
        <aside className="account-rail">
          <div className="avatar" aria-hidden="true">
            <span>A</span>
          </div>
          <strong>{demo ? 'Conta de demonstração' : 'Sua conta'}</strong>
          <p>{demo ? 'Nada é enviado a um servidor.' : 'Sessão iniciada neste dispositivo.'}</p>
          <nav aria-label="Menu da conta">
            <NavLink to="/conta" end>
              Minha conta
            </NavLink>
            <NavLink to="/historico">Meu histórico</NavLink>
            <NavLink to="/privacidade">Privacidade</NavLink>
            <button type="button" onClick={signOut}>
              Sair da conta
            </button>
          </nav>
        </aside>

        <div className="account-main">
          <section className="sheet sheet--pad">
            <p className="section-label">Histórico e privacidade</p>
            <h2>O que você quer manter?</h2>

            <div className="setting-row">
              <div>
                <h3>Vincular o histórico à conta</h3>
                <p id="vinculo-nota">
                  {auth.historyLinked
                    ? 'As próximas verificações ficam ligadas à sua conta.'
                    : 'Hoje o histórico fica só neste navegador. Vincular depende da sua confirmação.'}
                </p>
              </div>
              <SwitchField
                label="Vincular"
                checked={auth.historyLinked}
                describedBy="vinculo-nota"
                onChange={(checked) => {
                  if (checked) setMigrateOpen(true)
                  else linkHistory(false)
                }}
              />
            </div>

            <div className="setting-row">
              <div>
                <h3>Consultar o histórico</h3>
                <p>Releia resultados e acompanhe as suas verificações.</p>
              </div>
              <Button to="/historico" variant="outline" size="small">
                Ver histórico
              </Button>
            </div>

            <div className="setting-row">
              <div>
                <h3>Limpar o histórico</h3>
                <p>Apague as verificações guardadas neste navegador.</p>
              </div>
              <Button variant="outline" size="small" disabled={items.length === 0} onClick={() => setClearOpen(true)}>
                Limpar histórico
              </Button>
            </div>
          </section>

          <section className="sheet sheet--pad danger-sheet">
            <p className="section-label">Atenção: ação definitiva</p>
            <h2>Excluir conta</h2>
            <p>
              Encerra o seu acesso e apaga os dados da conta e o histórico vinculado a ela. Antes de confirmar, você vê
              exatamente o que acontece.
            </p>
            <div>
              <Button variant="danger" size="small" onClick={() => setDeleteOpen(true)}>
                Excluir minha conta
              </Button>
            </div>
          </section>
        </div>
      </div>

      <MigrateHistoryDialog
        open={migrateOpen}
        count={items.length}
        busy={busy}
        onLink={() => linkHistory(true)}
        onKeepLocal={() => setMigrateOpen(false)}
      />

      <ConfirmDialog
        open={clearOpen}
        eyebrow="Ação definitiva"
        title="Limpar todo o histórico?"
        confirmLabel="Limpar histórico"
        onConfirm={clearHistory}
        onCancel={() => setClearOpen(false)}
      >
        <p>
          Isso apaga {items.length === 1 ? 'a verificação guardada' : `as ${items.length} verificações guardadas`} neste
          navegador. Não dá para desfazer.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        eyebrow="Ação definitiva"
        title="Excluir a conta?"
        confirmLabel="Excluir minha conta"
        busy={busy}
        onConfirm={deleteAccount}
        onCancel={() => setDeleteOpen(false)}
      >
        <p>O que acontece se você confirmar:</p>
        <ul className="bullets">
          <li>O seu acesso é encerrado neste dispositivo.</li>
          <li>Os dados da conta e o histórico vinculado a ela deixam de estar disponíveis para você.</li>
          <li>O histórico guardado só neste navegador não é tocado; você pode limpá-lo à parte.</li>
        </ul>
        {demo ? (
          <Notice tone="info">Demonstração: nenhum dado foi enviado a um servidor, então não há o que apagar fora deste navegador.</Notice>
        ) : (
          <p>Registros que a lei obrigue a manter ficam separados, reduzidos ao mínimo e com prazo definido.</p>
        )}
        <p>Não dá para desfazer.</p>
      </ConfirmDialog>
    </div>
  )
}
