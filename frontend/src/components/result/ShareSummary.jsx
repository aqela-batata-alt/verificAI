import { useEffect, useMemo, useRef, useState } from 'react'
import { buildShareSummary } from '../../domain/share.js'
import { useToast } from '../../state/toast.jsx'
import Button from '../ui/Button.jsx'
import Disclosure from '../ui/Disclosure.jsx'
import Notice from '../ui/Notice.jsx'

// Resumo copiável (RF18). O texto sai de domain/share.js: status, alegação, data, limitações e
// links das fontes, avisando que a análise foi automática e sem apresentar uma análise
// inconclusiva como conclusão. A pessoa pode ler o texto antes de copiar.
//
// Se o navegador negar o acesso à área de transferência (janela sem permissão, navegador antigo),
// o texto aparece selecionado para ser copiado à mão.

/** @param {{ analysis: import('../../domain/analysis.js').Analysis }} props */
export default function ShareSummary({ analysis }) {
  const toast = useToast()
  const summary = useMemo(() => buildShareSummary(analysis), [analysis])
  const [manual, setManual] = useState(false)
  const areaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))

  // select() sozinho não leva o foco ao campo em todos os navegadores, e sem foco a seleção nem aparece.
  useEffect(() => {
    if (!manual) return
    areaRef.current?.focus()
    areaRef.current?.select()
  }, [manual])

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard indisponível')
      await navigator.clipboard.writeText(summary)
      setManual(false)
      toast.show({ message: 'Resumo copiado. Cole onde quiser compartilhar.', tone: 'success' })
    } catch {
      setManual(true)
    }
  }

  return (
    <section className="side-panel">
      <h2>Compartilhar com cuidado</h2>
      <p>
        Copie um resumo com o status, a alegação, a data, as limitações e os links das fontes. O resumo avisa que a
        análise foi automática.
      </p>
      <Button variant="outline" icon="copy" onClick={copy}>
        Copiar resumo
      </Button>

      {manual ? (
        <>
          <Notice tone="warning" role="status">
            Não foi possível copiar sozinho. O texto está selecionado: copie com Ctrl+C (ou toque e segure, no celular).
          </Notice>
          <label className="sr-only" htmlFor="resumo-copia">
            Texto do resumo
          </label>
          <textarea id="resumo-copia" ref={areaRef} className="share-preview" readOnly value={summary} />
        </>
      ) : (
        <Disclosure title="Ver o texto do resumo">
          <pre className="share-text">{summary}</pre>
        </Disclosure>
      )}
    </section>
  )
}
