import { formatRemaining } from '../../domain/format.js'
import { useVisitorLimit } from '../../hooks/useVisitorLimit.js'
import Icon from '../ui/Icon.jsx'

/**
 * Quantas análises ainda restam ao visitante (RF33). Os pontos são só reforço visual: o número
 * e o prazo estão escritos, e o texto é o que o leitor de tela lê.
 *
 * Quem está com a conta conectada não tem o limite de visitante.
 */
export default function UsageMeter() {
  const { isVisitor, max, remaining, used, msUntilRenewal } = useVisitorLimit()

  if (!isVisitor) {
    return (
      <p className="usage">
        <Icon name="user" />
        <span>Conta conectada: sem limite de visitante.</span>
      </p>
    )
  }

  return (
    <p className="usage">
      <span className="usage__dots" aria-hidden="true">
        {Array.from({ length: max }, (_, index) => (
          <i key={index} className={index < used ? 'usage__dot usage__dot--used' : 'usage__dot'} />
        ))}
      </span>
      <span>
        <strong>
          {remaining} de {max}
        </strong>{' '}
        análises disponíveis
        {msUntilRenewal === null ? (
          <> · a janela de 24 h começa na primeira análise</>
        ) : (
          <> · renovação em {formatRemaining(msUntilRenewal)}</>
        )}
      </span>
    </p>
  )
}
