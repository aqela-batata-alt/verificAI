import { Link } from 'react-router-dom'
import { useServices } from '../../state/services.jsx'

/**
 * Aviso permanente enquanto conta e envio de avaliações forem de demonstração (o back end ainda
 * não tem esses endpoints). Ninguém deve digitar uma senha real achando que ela é guardada com
 * segurança, nem achar que a avaliação chegou à equipe. O aviso some sozinho quando os
 * gateways reais forem ligados (mode "real").
 */
export default function DemoBanner() {
  const { auth, feedback } = useServices()
  const accountsDemo = auth?.mode === 'demo'
  const feedbackDemo = feedback?.mode === 'demo'
  if (!accountsDemo && !feedbackDemo) return null

  // O verbo concorda com o sujeito: "Conta e entrada funcionam", "O envio de avaliações funciona".
  const what =
    accountsDemo && feedbackDemo
      ? 'Conta, entrada e avaliações da análise funcionam'
      : accountsDemo
        ? 'Conta e entrada funcionam'
        : 'O envio de avaliações da análise funciona'

  return (
    <aside className="demo-bar" aria-label="Aviso de demonstração">
      <div className="wrap demo-bar__row">
        <p>
          <strong>DEMONSTRAÇÃO</strong> · {what} só neste navegador. Nada do que você digitar nesses
          recursos é enviado a um servidor.
        </p>
        <Link to="/privacidade#demonstracao">O que isso significa</Link>
      </div>
    </aside>
  )
}
