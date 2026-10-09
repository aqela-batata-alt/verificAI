import { useRef } from 'react'
import Icon from './Icon.jsx'

// Abas segundo o padrão de práticas do WAI-ARIA (APG, "Tabs"): uma só aba entra na ordem do Tab
// (a selecionada), as setas movem entre as abas, Home e End vão à primeira e à última, e a aba
// recebe o painel por aria-controls. Como o painel troca na hora, a ativação é automática.
//
// Uma aba pode estar "indisponível" (aria-disabled): continua alcançável pelo teclado para que a
// explicação ("Em breve") seja lida, mas não pode ser selecionada.

/** @param {string} prefix @param {string} id */
export const tabId = (prefix, id) => `${prefix}-aba-${id}`
/** @param {string} prefix */
export const panelId = (prefix) => `${prefix}-painel`

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon?: string,
 *   disabled?: boolean,
 *   badge?: string,
 *   describedBy?: string,
 * }} TabItem
 */

/**
 * @param {{
 *   label: string,
 *   idPrefix: string,
 *   value: string,
 *   onChange: (id: string) => void,
 *   tabs: TabItem[],
 * }} props
 */
export default function Tabs({ label, idPrefix, value, onChange, tabs }) {
  /** @type {import('react').MutableRefObject<Record<string, HTMLButtonElement | null>>} */
  const refs = useRef({})

  /** @param {number} index */
  function focusTab(index) {
    const tab = tabs[index]
    refs.current[tab.id]?.focus()
    if (!tab.disabled) onChange(tab.id)
  }

  /** @param {import('react').KeyboardEvent} event @param {number} index */
  function onKeyDown(event, index) {
    const last = tabs.length - 1
    /** @type {number | null} */
    let target = null
    if (event.key === 'ArrowRight') target = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') target = index === 0 ? last : index - 1
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = last
    if (target === null) return
    event.preventDefault()
    focusTab(target)
  }

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            className="tabs__tab"
            aria-selected={selected}
            aria-controls={selected ? panelId(idPrefix) : undefined}
            aria-disabled={tab.disabled ? 'true' : undefined}
            aria-describedby={tab.describedBy}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id)
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.icon ? <Icon name={tab.icon} /> : null}
            <span>{tab.label}</span>
            {tab.badge ? <span className="tabs__soon">{tab.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
