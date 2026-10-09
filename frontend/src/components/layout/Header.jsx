import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import Brand from './Brand.jsx'

/**
 * Cabeçalho e navegação principal (RF23). A navegação continua identificável em qualquer largura:
 * em telas grandes são links na própria barra; em telas pequenas, um botão "Menu" com texto
 * (não só o ícone de três linhas) abre o mesmo menu logo abaixo (APG, "Disclosure Navigation").
 */
export default function Header() {
  const { available, signedIn } = useAuth()
  const location = useLocation()
  // O menu guarda a página em que foi aberto: ao trocar de página ele deixa de estar "aberto"
  // sem precisar de um efeito para fechá-lo.
  const [openedOn, setOpenedOn] = useState(/** @type {string | null} */ (null))
  const open = openedOn === location.pathname
  const setOpen = (/** @type {boolean | ((current: boolean) => boolean)} */ next) => {
    const value = typeof next === 'function' ? next(open) : next
    setOpenedOn(value ? location.pathname : null)
  }
  const menuId = useId()
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null))

  // Esc fecha o menu aberto e devolve o foco ao botão.
  useEffect(() => {
    if (!open) return undefined
    /** @param {KeyboardEvent} event */
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpen só troca o estado local
  }, [open])

  return (
    <header className="site-header">
      <div className="wrap site-header__row">
        <Brand />
        <button
          ref={buttonRef}
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name={open ? 'close' : 'menu'} />
          <span>Menu</span>
        </button>
        <nav id={menuId} className="site-nav" aria-label="Navegação principal" data-open={open}>
          <ul className="site-nav__list">
            <li>
              <NavLink to="/" end>
                Verificar notícia
              </NavLink>
            </li>
            <li>
              <NavLink to="/como-funciona">Como funciona</NavLink>
            </li>
            <li>
              <NavLink to="/historico">Meu histórico</NavLink>
            </li>
          </ul>
          <ul className="site-nav__list">
            <li>
              <NavLink to="/privacidade">Privacidade</NavLink>
            </li>
            {available ? (
              <li>
                {signedIn ? (
                  <Button to="/conta" size="small" iconEnd="arrow">
                    Minha conta
                  </Button>
                ) : (
                  <Button to="/entrar" size="small" iconEnd="arrow">
                    Entrar
                  </Button>
                )}
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </header>
  )
}
