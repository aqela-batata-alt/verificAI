import { useRef, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate } from 'react-router-dom'
import MigrateHistoryDialog from '../components/account/MigrateHistoryDialog.jsx'
import { BrandLogo } from '../components/layout/Brand.jsx'
import Button from '../components/ui/Button.jsx'
import { CheckboxField, PasswordField, TextField } from '../components/ui/Field.jsx'
import Icon from '../components/ui/Icon.jsx'
import Notice from '../components/ui/Notice.jsx'
import { PASSWORD_MIN_LENGTH, validateSignIn, validateSignUp } from '../domain/auth.js'
import { useAuth } from '../hooks/useAuth.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useHistory } from '../hooks/useHistory.js'
import { useToast } from '../state/toast.jsx'

// Entrar e criar conta (RF31).
//  - O cadastro pede só e-mail e senha: "apenas os dados necessários".
//  - Falha ao entrar nunca diz se a conta existe (mensagem única).
//  - Se há histórico neste navegador, a pessoa decide se quer vinculá-lo (RF28). Sem resposta
//    explícita, nada é vinculado.
//  - Com a conta de demonstração, nada é enviado: o aviso fica junto do botão.

/** @param {{ mode: 'signin' | 'signup' }} props */
export default function AuthPage({ mode }) {
  const signup = mode === 'signup'
  useDocumentTitle(signup ? 'Criar conta' : 'Entrar')

  const auth = useAuth()
  const { items } = useHistory()
  const navigate = useNavigate()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}))
  const [failed, setFailed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [migrateOpen, setMigrateOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  // Marca que a pessoa já decidiu para onde ir. O roteador troca de página como "transição" (menos
  // prioritária que os estados locais): sem este marcador, por um instante a página se via "já
  // conectada", redirecionava para /conta e atropelava o navigate('/').
  const [leaving, setLeaving] = useState(false)

  const emailRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const passwordRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const privacyRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  // Quem já entrou não precisa desta página (a decisão sobre o histórico ainda pode estar aberta).
  if (auth.signedIn && !leaving && !submitting && !migrateOpen) return <Navigate to="/conta" replace />

  /** @param {import('react').FormEvent} event */
  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setFailed(false)

    const found = signup
      ? validateSignUp({ email, password, acceptedPrivacy: accepted })
      : validateSignIn({ email, password })
    setErrors(found)
    if (Object.keys(found).length > 0) {
      const first = found.email ? emailRef : found.password ? passwordRef : privacyRef
      first.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await (signup ? auth.signUp : auth.signIn)?.({ email: email.trim(), password })
      toast.show({
        message: signup ? 'Conta criada. Você já pode continuar.' : 'Você entrou.',
        tone: 'success',
      })
      if (items.length > 0) {
        setMigrateOpen(true)
      } else {
        setLeaving(true)
        navigate('/')
      }
    } catch {
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function chooseHistory(/** @type {boolean} */ link) {
    setLinking(true)
    try {
      if (link) await auth.linkHistory?.(true)
    } catch {
      toast.show({ message: 'Não foi possível vincular o histórico agora. Ele continua neste navegador.', tone: 'error' })
    } finally {
      setLinking(false)
      setLeaving(true)
      setMigrateOpen(false)
      navigate('/')
    }
  }

  return (
    <div className="wrap screen appear">
      <section className="auth-shell">
        <div className="auth-story dark-panel">
          <div className="logo-plaque">
            <BrandLogo />
          </div>
          <div>
            <p className="eyebrow">Sua conta é opcional</p>
            <h2>
              Um lugar para
              <br />
              seus segundos
              <br />
              olhares.
            </h2>
            <p>Guarde suas verificações e volte às explicações quando precisar.</p>
          </div>
          <ul className="auth-benefits">
            <li>
              <Icon name="check" />
              Histórico vinculado à conta
            </li>
            <li>
              <Icon name="check" />
              Continue depois do limite de visitante
            </li>
            <li>
              <Icon name="check" />
              Controle para apagar seus dados
            </li>
          </ul>
        </div>

        <div className="auth-form">
          <h1 tabIndex={-1}>{signup ? 'Crie sua conta.' : 'Bom ter você por aqui.'}</h1>
          <p className="auth-form__lead">
            {signup
              ? 'Só pedimos e-mail e senha.'
              : 'Entre para consultar e organizar o seu histórico.'}
          </p>

          <nav className="switcher" aria-label="Acesso">
            <NavLink to="/entrar">Entrar</NavLink>
            <NavLink to="/criar-conta">Criar conta</NavLink>
          </nav>

          <form noValidate onSubmit={handleSubmit}>
            {failed ? (
              <Notice tone="error" role="alert">
                {signup
                  ? 'Não foi possível criar a conta agora. Tente de novo em instantes.'
                  : 'Não foi possível entrar. Confira o e-mail e a senha e tente de novo.'}
              </Notice>
            ) : null}

            <TextField
              ref={emailRef}
              name="email"
              type="email"
              label="E-mail"
              inputMode="email"
              autoComplete={signup ? 'email' : 'username'}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="exemplo@email.com"
              value={email}
              error={errors.email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <PasswordField
              ref={passwordRef}
              name="senha"
              label="Senha"
              hint={signup ? `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              error={errors.password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {signup ? (
              <CheckboxField
                ref={privacyRef}
                name="privacidade"
                checked={accepted}
                error={errors.privacy}
                onChange={(event) => setAccepted(event.target.checked)}
              >
                Li a{' '}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                  Política de Privacidade<span className="sr-only"> (abre em uma nova aba)</span>
                </a>
                .
              </CheckboxField>
            ) : (
              <div className="auth-form__aside">
                <Link to="/recuperar-acesso">Esqueci minha senha</Link>
              </div>
            )}

            {auth.mode === 'demo' ? (
              <Notice tone="info">
                Conexão apenas demonstrativa: o e-mail e a senha digitados não são guardados nem enviados. Não use a sua
                senha de verdade.
              </Notice>
            ) : null}

            <Button type="submit" variant="gold" block iconEnd="arrow" disabled={submitting}>
              {submitting ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <p className="auth-form__fine">
            <Link to="/">Continuar sem uma conta</Link>
          </p>
        </div>
      </section>

      <MigrateHistoryDialog
        open={migrateOpen}
        count={items.length}
        busy={linking}
        onLink={() => chooseHistory(true)}
        onKeepLocal={() => chooseHistory(false)}
      />
    </div>
  )
}
