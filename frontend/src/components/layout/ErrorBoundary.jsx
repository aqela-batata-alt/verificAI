import { Component } from 'react'
import Button from '../ui/Button.jsx'

/**
 * Última rede de segurança: se um componente quebrar, a pessoa vê uma tela simples com uma saída
 * (recarregar), nunca uma página em branco. Nada do erro é mostrado nem enviado.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="wrap screen" id="conteudo" tabIndex={-1}>
        <div className="sheet sheet--pad empty-state" role="alert">
          <h1 tabIndex={-1}>Algo não saiu como esperado.</h1>
          <p>Não foi possível mostrar esta página. Recarregue para tentar de novo.</p>
          <Button variant="gold" onClick={() => window.location.reload()}>
            Recarregar a página
          </Button>
        </div>
      </main>
    )
  }
}
