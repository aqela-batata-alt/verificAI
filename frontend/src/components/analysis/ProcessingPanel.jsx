import { useEffect, useRef } from 'react'
import { RESPONSE_DEADLINE_MS } from '../../domain/limits.js'
import { normalizeText } from '../../domain/text.js'
import { useNow } from '../../hooks/useStore.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'

// Espera da análise (RF25, RNF01, RNF17).
//
// O RF25 proíbe progresso fictício. Por isso esta tela só afirma o que a interface sabe de
// verdade: o conteúdo foi recebido, a validação do navegador terminou, e a solicitação está
// em andamento no servidor. A API v1 é síncrona e não informa etapas intermediárias; quando
// existir um endpoint de acompanhamento (RF29), as etapas "extração da página" e "consulta a
// fontes" entram aqui com o estado real que ele devolver.
//
// O que se mostra de tempo é o tempo decorrido contra o prazo de 30 s do RNF01, em texto, sem
// barra: uma barra pareceria andamento da análise, e não é.

/** Depois disto, a tela avisa que a espera está maior que o normal (Nielsen: visibilidade do estado). */
const SLOW_AFTER_SECONDS = 10
const EXCERPT_CHARS = 160

/** @param {string} text */
function excerptOf(text) {
  const flat = normalizeText(text).replace(/\s+/g, ' ')
  const chars = Array.from(flat)
  return chars.length > EXCERPT_CHARS ? `${chars.slice(0, EXCERPT_CHARS).join('').trimEnd()}…` : flat
}

/**
 * @param {{
 *   input: import('../../services/analysesApi.js').AnalysisInput | null,
 *   startedAt: number | null,
 *   onCancel: () => void,
 * }} props
 */
export default function ProcessingPanel({ input, startedAt, onCancel }) {
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null))
  const now = useNow(1000)
  const elapsed = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000))
  const slow = elapsed >= SLOW_AFTER_SECONDS
  const deadline = Math.round(RESPONSE_DEADLINE_MS / 1000)
  const isUrl = input?.inputType === 'url'
  const preview = !input ? '' : input.inputType === 'url' ? input.url : excerptOf(input.text)

  // O botão "Verificar agora" some da tela quando a espera começa; o foco vai para o título,
  // para não cair no início da página (WCAG 2.4.3).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="processing">
      <div className="processing__head">
        <span className="spinner" aria-hidden="true" />
        <div>
          <h2 ref={headingRef} tabIndex={-1}>
            Recebemos o seu conteúdo.
          </h2>
          <p>A análise está em andamento e leva até {deadline} segundos.</p>
        </div>
      </div>

      {preview ? (
        <blockquote className="processing__quote">
          <span className="sr-only">{isUrl ? 'Endereço enviado: ' : 'Início do conteúdo enviado: '}</span>
          {isUrl ? preview : `“${preview}”`}
        </blockquote>
      ) : null}

      <ol className="processing__steps" aria-label="Etapas conhecidas">
        <li className="processing__step processing__step--done">
          <Icon name="check" />
          <span>
            Validação do conteúdo <span className="processing__state">concluída</span>
          </span>
        </li>
        <li className="processing__step">
          <Icon name="clock" />
          <span>
            {isUrl ? 'Leitura da página e análise' : 'Análise do texto'}{' '}
            <span className="processing__state">em andamento</span>
          </span>
        </li>
      </ol>

      {/* A região existe desde o início para que o aviso, quando surgir, seja anunciado. */}
      <div role="status" className="processing__notice">
        {slow ? (
          <p>
            Está demorando mais do que o normal. O limite é de {deadline} segundos: se a resposta não chegar até lá,
            você poderá tentar de novo.
          </p>
        ) : null}
      </div>

      <div className="processing__foot">
        <span>
          Tempo decorrido: {elapsed} s (limite de {deadline} s)
        </span>
        <Button variant="outline" size="small" onClick={onCancel}>
          Cancelar análise
        </Button>
      </div>
    </div>
  )
}
