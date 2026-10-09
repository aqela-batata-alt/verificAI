import { Link } from 'react-router-dom'
import AnalysisAside from '../components/analysis/AnalysisAside.jsx'
import AnalysisForm from '../components/analysis/AnalysisForm.jsx'
import Icon from '../components/ui/Icon.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

// Página inicial. A área de análise vem logo depois do título (Krug: a pessoa chega com uma
// tarefa — conferir um texto —, então a tarefa está à vista sem rolar a página).

const METHOD = [
  {
    title: 'Uma leitura dos sinais',
    text: 'Entenda o que merece atenção no conteúdo, com os sinais explicados em palavras simples.',
  },
  {
    title: 'Fontes só quando existem',
    text: 'Se houver fontes relacionadas à alegação, elas aparecem no resultado. Se não houver, dizemos isso, sem inventar referências.',
  },
  {
    title: 'Orientação sem certezas falsas',
    text: 'Saiba quando verificar mais — e quando não é possível concluir.',
  },
]

export default function HomePage() {
  useDocumentTitle(undefined)

  return (
    <div className="wrap appear">
      <section className="home-intro">
        <div>
          <p className="eyebrow">Seu detetive da informação</p>
          <h1 tabIndex={-1}>
            Toda notícia merece
            <br />
            <em>um segundo olhar.</em>
          </h1>
        </div>
        <div className="hero-copy">
          <p>
            Recebeu algo duvidoso? Verifique os sinais, entenda o contexto e consulte as fontes antes de compartilhar.
          </p>
          <div className="hero-copy__note">
            <Icon name="check" />
            Sem cadastro para começar.
          </div>
        </div>
      </section>

      <div className="analysis-board">
        <AnalysisForm />
        <AnalysisAside />
      </div>

      <div className="after-form">
        <span>
          <Icon name="lock" />
          Não envie informações pessoais ou sigilosas.
        </span>
        <Link to="/privacidade">Como os dados são tratados</Link>
      </div>

      <section className="method-strip" aria-labelledby="metodo-titulo">
        <h2 id="metodo-titulo" className="sr-only">
          O que você recebe
        </h2>
        {METHOD.map((item, index) => (
          <article className="method-item" key={item.title}>
            <div className="method-item__n" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="home-footnote">
        <p>O melhor compartilhamento começa com uma pausa.</p>
        <Link className="link-action" to="/como-funciona">
          Conheça o método
          <Icon name="arrow" />
        </Link>
      </section>
    </div>
  )
}
