import { formatIndex } from '../../domain/format.js'
import { RISK_BANDS, STATUS_INFO, STATUS, bandForIndex } from '../../domain/status.js'

// Escala do índice de risco (RF13, RF16). É um "bullet graph" de Stephen Few: uma barra com as
// três faixas ao fundo e o valor como uma barra mais fina por cima. Posição sobre uma escala
// comum é a codificação visual que as pessoas leem com mais precisão (Cleveland e McGill), e
// substitui o medidor circular do protótipo, mais difícil de comparar com as faixas.
//
// O número e as faixas estão escritos: o desenho é só reforço e fica oculto para leitores de tela.

const BANDS = [
  { code: STATUS.LOW, range: `0 a ${RISK_BANDS.lowMax}` },
  { code: STATUS.ATTENTION, range: `Acima de ${RISK_BANDS.lowMax} até ${RISK_BANDS.attentionMax}` },
  { code: STATUS.HIGH, range: `Acima de ${RISK_BANDS.attentionMax} até ${RISK_BANDS.max}` },
]

/** @param {{ value: number }} props */
export default function RiskScale({ value }) {
  const current = bandForIndex(value)

  return (
    <div className="risk-scale">
      <p className="risk-scale__value">
        <span className="risk-scale__number">{formatIndex(value)}</span>
        <span className="risk-scale__of">de {RISK_BANDS.max} · índice de risco</span>
      </p>

      <div className="risk-scale__track" aria-hidden="true">
        <span className="risk-scale__band risk-scale__band--low" />
        <span className="risk-scale__band risk-scale__band--attention" />
        <span className="risk-scale__band risk-scale__band--high" />
        <span className="risk-scale__fill" style={{ '--value': value }} />
      </div>
      <div className="risk-scale__marks" aria-hidden="true">
        {[0, RISK_BANDS.lowMax, RISK_BANDS.attentionMax, RISK_BANDS.max].map((at) => (
          <span key={at} className="risk-scale__mark" style={{ '--at': at }}>
            {at}
          </span>
        ))}
      </div>

      <ul className="risk-scale__legend" aria-label="Faixas do índice de risco">
        {BANDS.map((band) => (
          <li key={band.code} aria-current={band.code === current ? 'true' : undefined}>
            <strong>{band.range}</strong>
            <span>
              {STATUS_INFO[band.code].label}
              {band.code === current ? <span className="sr-only"> (faixa deste resultado)</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
