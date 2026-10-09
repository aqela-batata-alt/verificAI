import { Link } from 'react-router-dom'
import markUrl from '../../assets/apura-mark.png'

/**
 * Marca do Apura: o olho com chapéu de detetive e o nome em texto (o nome é texto de verdade,
 * não imagem, para ampliar sem perda e ser lido por leitores de tela).
 */
export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Apura — página inicial">
      <img className="brand__mark" src={markUrl} alt="" width="240" height="155" />
      <span className="brand__name" aria-hidden="true">
        Apura
      </span>
    </Link>
  )
}

/** A mesma marca, sem link e escondida de leitores de tela: para enfeitar painéis. */
export function BrandLogo() {
  return (
    <span className="brand" aria-hidden="true">
      <img className="brand__mark" src={markUrl} alt="" width="240" height="155" />
      <span className="brand__name">Apura</span>
    </span>
  )
}
