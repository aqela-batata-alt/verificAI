import PageHeading from '../components/layout/PageHeading.jsx'
import Button from '../components/ui/Button.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

// Endereço que não existe. Norman e Nielsen (ajudar a pessoa a se recuperar de erros): diz o que
// aconteceu em palavras simples e oferece os caminhos de volta, sem culpar quem digitou.

export default function NotFoundPage() {
  useDocumentTitle('Página não encontrada')

  return (
    <div className="wrap screen appear">
      <PageHeading eyebrow="Erro 404" title="Não encontramos esta página." />
      <div className="sheet empty-state">
        <h2>O endereço pode estar errado ou a página mudou de lugar.</h2>
        <p>Volte ao início para verificar um conteúdo ou consulte as verificações que você já fez neste navegador.</p>
        <div className="cluster">
          <Button to="/" variant="gold" iconEnd="arrow">
            Verificar uma notícia
          </Button>
          <Button to="/historico" variant="outline">
            Meu histórico
          </Button>
        </div>
      </div>
    </div>
  )
}
