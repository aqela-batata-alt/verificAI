import { formatDateParts } from '../../domain/format.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'

/**
 * Uma linha do histórico (RF20, RF28): alegação resumida, status, data e ações. O texto integral
 * nunca está aqui. "Abrir" leva ao resultado pelo identificador; o resumo da alegação é só texto, para
 * a linha ter uma ação por vez no teclado (como no protótipo).
 *
 * @param {{
 *   item: import('../../domain/history.js').HistoryItem,
 *   onDelete: (item: import('../../domain/history.js').HistoryItem) => void,
 * }} props
 */
export default function HistoryRow({ item, onDelete }) {
  const when = formatDateParts(item.createdAt)
  const claim = item.claim || 'Alegação sem resumo'

  return (
    <li className="history-row">
      <div className="history-text">
        <strong>{claim}</strong>
        <span>{item.inputType === 'url' ? 'Link' : 'Texto colado'}</span>
      </div>
      <div className="history-status">
        <StatusBadge code={item.status} short />
      </div>
      <time dateTime={item.createdAt}>
        {when.date}
        {when.time ? <span> · {when.time}</span> : null}
      </time>
      <div className="row-actions">
        <Button to={`/resultado/${encodeURIComponent(item.id)}`} variant="outline" size="small" data-row-primary>
          Abrir<span className="sr-only">: {claim}</span>
        </Button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Excluir do histórico: ${claim}`}
          onClick={() => onDelete(item)}
        >
          <Icon name="trash" />
        </button>
      </div>
    </li>
  )
}
