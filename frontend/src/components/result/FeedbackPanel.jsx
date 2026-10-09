import { useId, useState } from 'react'
import { FEEDBACK_COMMENT_MAX_CHARS, FEEDBACK_COMMENT_RETENTION_DAYS } from '../../domain/limits.js'
import { formatNumber } from '../../domain/format.js'
import { useServices } from '../../state/services.jsx'
import Button from '../ui/Button.jsx'
import { TextAreaField } from '../ui/Field.jsx'
import Icon from '../ui/Icon.jsx'
import Notice from '../ui/Notice.jsx'

// Feedback da análise (RF19): "útil" ou "não útil" e um comentário opcional. Antes do envio, a
// tela diz para que serve e como os dados são tratados. A pessoa pode mandar só a avaliação.
// O feedback nunca é rótulo de verdade nem altera o resultado.
//
// Sem endpoint de feedback no back end (Etapa 4), o gateway de demonstração só valida e
// descarta, e o aviso diz isso com todas as letras. O texto do modo real descreve o que o RF19 e o
// RNF10 exigem do back end; ele só aparece quando existir um gateway real.

/** @param {{ analysisId: string }} props */
export default function FeedbackPanel({ analysisId }) {
  const { feedback } = useServices()
  const [useful, setUseful] = useState(/** @type {boolean | null} */ (null))
  const [comment, setComment] = useState('')
  const [phase, setPhase] = useState(/** @type {'editing' | 'sending' | 'sent' | 'failed'} */ ('editing'))
  const [sentAs, setSentAs] = useState(/** @type {{ delivered: boolean } | null} */ (null))
  const noticeId = useId()

  if (!feedback) return null

  const tooLong = comment.length > FEEDBACK_COMMENT_MAX_CHARS
  const demo = feedback.mode === 'demo'

  async function send() {
    if (useful === null || tooLong || !feedback) return
    setPhase('sending')
    try {
      const result = await feedback.submit({ analysisId, useful, comment: comment.trim() })
      setSentAs(result)
      setPhase('sent')
    } catch {
      setPhase('failed')
    }
  }

  if (phase === 'sent') {
    return (
      <section className="side-panel">
        <h2>A explicação ajudou?</h2>
        <Notice tone="success" role="status">
          {sentAs?.delivered
            ? 'Obrigado! Sua avaliação foi enviada.'
            : 'Obrigado! Como esta é uma versão de demonstração, a avaliação não foi enviada nem guardada.'}
        </Notice>
      </section>
    )
  }

  return (
    <section className="side-panel">
      <h2>A explicação ajudou?</h2>
      <p>Uma resposta útil também precisa ser fácil de entender. Sua avaliação não muda este resultado.</p>

      <div className="choice-group" role="group" aria-label="Avaliação da explicação">
        <Button variant="outline" size="small" icon="up" aria-pressed={useful === true} onClick={() => setUseful(true)}>
          Sim
        </Button>
        <Button
          variant="outline"
          size="small"
          icon="down"
          aria-pressed={useful === false}
          onClick={() => setUseful(false)}
        >
          Não
        </Button>
      </div>

      {useful !== null ? (
        <div className="feedback-form">
          <TextAreaField
            label="Quer contar mais? (opcional)"
            hint={`Até ${formatNumber(FEEDBACK_COMMENT_MAX_CHARS)} caracteres`}
            value={comment}
            error={tooLong ? `O comentário passou de ${formatNumber(FEEDBACK_COMMENT_MAX_CHARS)} caracteres.` : undefined}
            describedBy={noticeId}
            rows={3}
            onChange={(event) => setComment(event.target.value)}
          />
          <p id={noticeId} className="feedback-form__notice">
            {demo
              ? 'Versão de demonstração: nada do que você escrever aqui é enviado nem guardado.'
              : `Para que serve: entender se a explicação foi útil e melhorar a clareza. A avaliação não muda este resultado nem é usada como rótulo para treinar o modelo. O comentário é guardado por até ${FEEDBACK_COMMENT_RETENTION_DAYS} dias. O texto analisado não é enviado. Não escreva dados pessoais.`}
          </p>
          {phase === 'failed' ? (
            <Notice tone="error" role="alert">
              Não foi possível enviar agora. Tente de novo em instantes.
            </Notice>
          ) : null}
          <Button onClick={send} disabled={phase === 'sending' || tooLong} icon={phase === 'sending' ? undefined : 'check'}>
            {phase === 'sending' ? 'Enviando…' : 'Enviar avaliação'}
          </Button>
        </div>
      ) : (
        <p className="feedback-form__notice">
          <Icon name="info" /> Escolha uma resposta para continuar. O comentário é opcional.
        </p>
      )}
    </section>
  )
}
