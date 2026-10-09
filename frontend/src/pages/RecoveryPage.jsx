import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import { TextField } from '../components/ui/Field.jsx'
import Icon from '../components/ui/Icon.jsx'
import Notice from '../components/ui/Notice.jsx'
import { validateRecovery } from '../domain/auth.js'
import { useAuth } from '../hooks/useAuth.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

// Recuperar o acesso (RF32). A resposta é a mesma exista ou não uma conta com aquele e-mail, para
// não revelar quem tem conta (RF31). O link ou código de uso único com validade limitada é
// responsabilidade do back end; na demonstração nenhuma mensagem é enviada, e a tela diz isso.

export default function RecoveryPage() {
  useDocumentTitle('Recuperar acesso')
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(/** @type {string | undefined} */ (undefined))
  const [phase, setPhase] = useState(/** @type {'editing' | 'sending' | 'sent' | 'failed'} */ ('editing'))
  const emailRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const confirmationRef = useRef(/** @type {HTMLHeadingElement | null} */ (null))

  // O botão "Enviar instruções" sai da tela quando a confirmação aparece; sem isto o foco cairia
  // no começo do documento e quem usa teclado ou leitor de tela perderia o lugar (WCAG 2.4.3).
  useEffect(() => {
    if (phase === 'sent') confirmationRef.current?.focus()
  }, [phase])

  /** @param {import('react').FormEvent} event */
  async function handleSubmit(event) {
    event.preventDefault()
    if (phase === 'sending') return
    const found = validateRecovery({ email })
    setError(found.email)
    if (found.email) {
      emailRef.current?.focus()
      return
    }
    setPhase('sending')
    try {
      await auth.requestRecovery?.({ email: email.trim() })
      setPhase('sent')
    } catch {
      setPhase('failed')
    }
  }

  return (
    <div className="wrap screen appear">
      <div className="recovery-wrap">
        <Link className="back-link" to="/entrar">
          <Icon name="back" />
          Voltar para o acesso
        </Link>

        <section className="sheet sheet--pad">
          {phase === 'sent' ? (
            <>
              <div className="success-seal">
                <Icon name="mail" />
              </div>
              <h1 ref={confirmationRef} tabIndex={-1}>
                Confira o seu e-mail.
              </h1>
              <p>
                Se houver uma conta com esse e-mail, enviaremos as instruções para criar uma nova senha. A resposta é a
                mesma para qualquer e-mail, para proteger a privacidade de quem tem conta.
              </p>
              {auth.mode === 'demo' ? (
                <Notice tone="info">Fluxo simulado: esta versão não envia mensagens.</Notice>
              ) : null}
              <p className="auth-form__fine">
                <Link to="/entrar">Voltar para o acesso</Link>
              </p>
            </>
          ) : (
            <>
              <div className="recovery-illustration">
                <Icon name="mail" />
              </div>
              <p className="eyebrow">Vamos recuperar seu acesso</p>
              <h1 tabIndex={-1}>
                Uma nova senha.
                <br />
                Um novo começo.
              </h1>
              <p>Informe o e-mail usado na conta para receber as instruções de recuperação.</p>
              <form noValidate onSubmit={handleSubmit}>
                {phase === 'failed' ? (
                  <Notice tone="error" role="alert">
                    Não foi possível enviar agora. Tente de novo em instantes.
                  </Notice>
                ) : null}
                <TextField
                  ref={emailRef}
                  name="email"
                  type="email"
                  label="E-mail da conta"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="exemplo@email.com"
                  value={email}
                  error={error}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {auth.mode === 'demo' ? (
                  <Notice tone="info">Fluxo simulado: esta versão não envia mensagens.</Notice>
                ) : null}
                <Button type="submit" variant="gold" block iconEnd="arrow" disabled={phase === 'sending'}>
                  {phase === 'sending' ? 'Enviando…' : 'Enviar instruções'}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
