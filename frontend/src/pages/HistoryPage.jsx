import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import HistoryRow from '../components/history/HistoryRow.jsx'
import PageHeading from '../components/layout/PageHeading.jsx'
import Button from '../components/ui/Button.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { SwitchField } from '../components/ui/Field.jsx'
import Icon from '../components/ui/Icon.jsx'
import Notice from '../components/ui/Notice.jsx'
import { filterHistory } from '../domain/history.js'
import { STATUS_CODES, STATUS_INFO } from '../domain/status.js'
import { useAuth } from '../hooks/useAuth.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useHistory } from '../hooks/useHistory.js'
import { useToast } from '../state/toast.jsx'

// Histórico local (RF20, RF28).
//  - Mostra só alegação resumida, status, data e identificador: o texto integral nunca é guardado.
//  - Excluir um item tira a linha da tela na hora e oferece "Desfazer" (Aza Raskin: desfazer em
//    vez de pedir confirmação a cada exclusão).
//  - Limpar tudo pede confirmação, porque apaga muitos registros de uma vez.
//  - O histórico é opcional: dá para desligar a gravação das próximas análises.

const FILTERS = [{ id: 'all', label: 'Todos' }, ...STATUS_CODES.map((code) => ({ id: code, label: STATUS_INFO[code].shortLabel }))]

export default function HistoryPage() {
  useDocumentTitle('Meu histórico')
  const { items, enabled, persistent, remove, restore, clear, setEnabled } = useHistory()
  const { available, mode, signedIn } = useAuth()
  const toast = useToast()

  const [status, setStatus] = useState(/** @type {'all' | import('../domain/status.js').StatusCode} */ ('all'))
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const listRef = useRef(/** @type {HTMLUListElement | null} */ (null))
  const emptyRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const focusIndex = useRef(/** @type {number | null} */ (null))
  const switchNoteId = useId()
  const searchId = useId()

  const visible = useMemo(() => filterHistory(items, { status, query }), [items, status, query])
  const filtering = status !== 'all' || query.trim() !== ''

  // Depois de excluir uma linha, o foco vai para a próxima (ou a anterior), para não se perder.
  useEffect(() => {
    if (focusIndex.current === null) return
    const index = focusIndex.current
    focusIndex.current = null
    const links = listRef.current?.querySelectorAll('[data-row-primary]')
    if (links && links.length > 0) {
      const target = links[Math.min(index, links.length - 1)]
      if (target instanceof HTMLElement) target.focus()
    } else {
      emptyRef.current?.focus()
    }
  }, [items])

  /** @param {import('../domain/history.js').HistoryItem} item */
  function handleDelete(item) {
    const position = visible.findIndex((entry) => entry.id === item.id)
    const removed = remove(item.id)
    if (!removed) return
    focusIndex.current = Math.max(position, 0)
    toast.show({
      message: 'Verificação excluída do histórico.',
      tone: 'info',
      action: { label: 'Desfazer', onAction: () => restore(removed.item, removed.index) },
    })
  }

  function handleClear() {
    const total = items.length
    clear()
    setConfirmClear(false)
    focusIndex.current = 0
    toast.show({ message: total === 1 ? 'Histórico limpo: 1 verificação apagada.' : `Histórico limpo: ${total} verificações apagadas.`, tone: 'success' })
  }

  function resetFilters() {
    setStatus('all')
    setQuery('')
  }

  return (
    <div className="wrap screen appear">
      <PageHeading
        eyebrow="Suas verificações"
        title="Meu histórico"
        lead="Volte às explicações, compare contextos e mantenha o que é importante."
        action={
          items.length > 0 ? (
            <Button variant="outline" size="small" icon="trash" onClick={() => setConfirmClear(true)}>
              Limpar histórico
            </Button>
          ) : null
        }
      />

      <div className="history-banner">
        <div>
          <strong>
            {signedIn
              ? mode === 'demo'
                ? 'Você está numa conta de demonstração.'
                : 'Você está com a conta conectada.'
              : 'Seu histórico fica só neste navegador.'}
          </strong>
          <p>
            {signedIn && mode === 'demo'
              ? 'A sincronização é simulada: esta versão não usa servidor, e o histórico continua só neste navegador.'
              : 'Ele guarda a alegação resumida, o status e a data, nunca o texto completo. Se você limpar os dados do navegador, ele some.'}
          </p>
        </div>
        {available ? (
          signedIn ? (
            <Link className="link-action" to="/conta">
              Minha conta
              <Icon name="arrow" />
            </Link>
          ) : (
            <Link className="link-action" to="/entrar">
              Entrar
              <Icon name="arrow" />
            </Link>
          )
        ) : null}
      </div>

      <div className="history-setting">
        <SwitchField
          label="Guardar o histórico neste navegador"
          checked={enabled}
          onChange={setEnabled}
          describedBy={switchNoteId}
        />
        <p id={switchNoteId} className="history-setting__note">
          {enabled
            ? 'As próximas verificações aparecem aqui.'
            : 'Desligado: as próximas verificações não serão guardadas. O que já está aqui continua até você apagar.'}
        </p>
      </div>

      {!persistent ? (
        <Notice tone="warning" role="status" className="history-notice">
          Este navegador não deixa guardar o histórico (isso acontece, por exemplo, em janelas privativas). Ele vale só
          enquanto esta página estiver aberta.
        </Notice>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="history-toolbar">
            <div className="filter-row" role="group" aria-label="Filtrar por resultado">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className="filter"
                  aria-pressed={status === filter.id}
                  onClick={() => setStatus(/** @type {any} */ (filter.id))}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="search-field">
              <label className="sr-only" htmlFor={searchId}>
                Pesquisar no histórico
              </label>
              <Icon name="search" />
              <input
                id={searchId}
                type="search"
                className="input"
                placeholder="Buscar uma verificação"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <p className="history-count" role="status">
            {filtering
              ? `Mostrando ${visible.length} de ${items.length} ${items.length === 1 ? 'verificação' : 'verificações'}.`
              : `${items.length} ${items.length === 1 ? 'verificação guardada' : 'verificações guardadas'}.`}
          </p>

          {visible.length > 0 ? (
            <section className="sheet" aria-label="Lista de verificações">
              <div className="history-head" aria-hidden="true">
                <span>Conteúdo</span>
                <span>Resultado</span>
                <span>Quando</span>
                <span>Ações</span>
              </div>
              <ul ref={listRef} className="history-list">
                {visible.map((item) => (
                  <HistoryRow key={item.id} item={item} onDelete={handleDelete} />
                ))}
              </ul>
            </section>
          ) : (
            <div ref={emptyRef} tabIndex={-1} className="sheet empty-state">
              <h2>Nenhuma verificação com esse filtro.</h2>
              <p>Tente outra palavra ou outro resultado.</p>
              <Button variant="outline" onClick={resetFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </>
      ) : (
        <div ref={emptyRef} tabIndex={-1} className="sheet empty-state">
          <h2>{enabled ? 'Nada guardado por aqui ainda.' : 'O histórico está desligado.'}</h2>
          <p>
            {enabled
              ? 'Quando você verificar um conteúdo, o resumo dele aparece aqui.'
              : 'Ligue a chave acima para guardar as próximas verificações neste navegador.'}
          </p>
          <Button to="/" variant="gold" iconEnd="arrow">
            Verificar uma notícia
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        eyebrow="Ação definitiva"
        title="Limpar todo o histórico?"
        confirmLabel="Limpar histórico"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      >
        <p>
          Isso apaga {items.length === 1 ? 'a verificação guardada' : `as ${items.length} verificações guardadas`} neste
          navegador. Não dá para desfazer.
        </p>
        <p>
          Isto apaga só a lista guardada neste navegador. O registro técnico de cada análise, que não inclui o texto
          enviado, continua no servidor, como explica a página de Privacidade.
        </p>
      </ConfirmDialog>
    </div>
  )
}
