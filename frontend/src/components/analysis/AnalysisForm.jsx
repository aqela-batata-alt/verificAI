import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { describeError, fromValidation } from '../../domain/errors.js'
import { formatNumber } from '../../domain/format.js'
import { TEXT_LIMITS } from '../../domain/limits.js'
import { countCharacters, normalizeText } from '../../domain/text.js'
import { validateInput } from '../../domain/validation.js'
import { useAnalysisRun } from '../../state/analysisRun.jsx'
import { useServices } from '../../state/services.jsx'
import Button from '../ui/Button.jsx'
import { TextAreaField, TextField } from '../ui/Field.jsx'
import Tabs, { panelId, tabId } from '../ui/Tabs.jsx'
import ErrorPanel from './ErrorPanel.jsx'
import LimitDialog from './LimitDialog.jsx'
import ProcessingPanel from './ProcessingPanel.jsx'
import UsageMeter from './UsageMeter.jsx'

// Formulário de análise (RF24, RF25, RF27, RF33).
//
//  - A pessoa escolhe entre texto e URL em abas (APG: Tabs). Só a opção escolhida vai na
//    solicitação (RF24); a outra fica guardada no rascunho, na memória da página.
//  - A validação roda no envio, não a cada tecla (Wroblewski). O erro aparece escrito, ligado ao
//    campo por aria-describedby, e o foco vai para o campo.
//  - Durante a espera o formulário sai da tela: não há como disparar um segundo envio (RF25).
//  - Visitante sem análises restantes não inicia nada: vê o aviso do RF33.
//  - O texto não tem "maxlength": o navegador cortaria o que foi colado sem avisar (RF01).

/** Texto de exemplo vindo do protótipo v2 ("pedido de compartilhamento urgente"). */
export const EXAMPLE_TEXT = 'Todas as linhas de ônibus deixarão de funcionar no próximo domingo. Compartilhe com todo mundo!'

const PREFIX = 'entrada'

export default function AnalysisForm() {
  const { config, auth, visitorLimit } = useServices()
  const run = useAnalysisRun()
  const [validation, setValidation] = useState(/** @type {import('../../domain/errors.js').AppError | null} */ (null))
  const [limitOpen, setLimitOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const fieldRef = useRef(/** @type {HTMLInputElement | HTMLTextAreaElement | null} */ (null))
  const previousPhase = useRef(run.phase)

  const headingId = useId()
  const counterId = useId()
  const alertId = useId()
  const soonId = useId()

  const urlEnabled = config.urlInput
  const inputType = urlEnabled && run.draft.inputType === 'url' ? 'url' : 'text'
  const { text, url } = run.draft

  const shownError = validation ?? (run.phase === 'failed' ? run.error : null)
  const errorField = shownError ? describeError(shownError).field : null

  const length = useMemo(() => countCharacters(normalizeText(text)), [text])
  const over = length > TEXT_LIMITS.max

  // Erro ligado a um campo: o foco vai para o campo, que lê o erro por aria-describedby.
  // Erro sem campo (serviço fora do ar, tempo esgotado): o próprio painel recebe o foco.
  useEffect(() => {
    if (shownError && errorField) fieldRef.current?.focus()
  }, [shownError, errorField])

  // Cancelar a espera: o botão que estava com o foco sai da tela, então o foco volta ao campo.
  useEffect(() => {
    if (previousPhase.current === 'running' && run.phase === 'idle') fieldRef.current?.focus()
    previousPhase.current = run.phase
  }, [run.phase])

  // Pedido de foco que precisa esperar a troca de aba aparecer na tela.
  useEffect(() => {
    if (focusRequest > 0) fieldRef.current?.focus()
  }, [focusRequest])

  function clearErrors() {
    setValidation(null)
    if (run.phase === 'failed') run.dismissError()
  }

  /** @param {string} id */
  function handleTabChange(id) {
    run.setDraft({ inputType: id === 'url' ? 'url' : 'text' })
    clearErrors()
  }

  function fillExample() {
    run.setDraft({ inputType: 'text', text: EXAMPLE_TEXT })
    clearErrors()
    setFocusRequest((n) => n + 1)
  }

  const limitReached = () => !(auth?.getSnapshot().signedIn ?? false) && !visitorLimit.canStart()

  /** @param {import('react').FormEvent} event */
  async function handleSubmit(event) {
    event.preventDefault()
    if (run.phase === 'running') return // RF25: a solicitação ativa não se repete

    // RF33: a quarta tentativa não inicia processamento. Vem antes da validação porque
    // corrigir o texto não ajudaria agora.
    if (limitReached()) {
      setLimitOpen(true)
      return
    }

    const checked = validateInput({ inputType, text, url })
    if (!checked.ok) {
      setValidation(fromValidation(checked))
      return
    }
    setValidation(null)

    const outcome = await run.start(
      inputType === 'url' ? { inputType: 'url', url: checked.value } : { inputType: 'text', text: checked.value },
    )
    if (!outcome.started && outcome.reason === 'limit') setLimitOpen(true)
  }

  /** @param {import('../../domain/errors.js').ErrorActionId} action */
  async function handleErrorAction(action) {
    if (action === 'fix_input') {
      fieldRef.current?.focus()
    } else if (action === 'paste_text') {
      run.setDraft({ inputType: 'text' })
      clearErrors()
      setFocusRequest((n) => n + 1)
    } else if (action === 'retry') {
      const outcome = await run.retry()
      if (!outcome.started && outcome.reason === 'limit') setLimitOpen(true)
    } else if (action === 'reload') {
      window.location.reload()
    }
  }

  if (run.phase === 'running') {
    return (
      <div className="analysis-form">
        <ProcessingPanel input={run.input} startedAt={run.startedAt} onCancel={run.cancel} />
      </div>
    )
  }

  const describedBy = [inputType === 'text' ? counterId : null, shownError && errorField ? alertId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="analysis-form">
      <form noValidate onSubmit={handleSubmit} aria-labelledby={headingId}>
        <div className="analysis-form__top">
          <h2 id={headingId}>O que vamos investigar?</h2>
          <Tabs
            label="Formato da entrada"
            idPrefix={PREFIX}
            value={inputType}
            onChange={handleTabChange}
            tabs={[
              { id: 'text', label: 'Colar texto', icon: 'text' },
              urlEnabled
                ? { id: 'url', label: 'Inserir link', icon: 'link' }
                : { id: 'url', label: 'Inserir link', icon: 'link', disabled: true, badge: 'Em breve', describedBy: soonId },
            ]}
          />
          {urlEnabled ? null : (
            <span id={soonId} className="sr-only">
              A análise por link ainda não está disponível. Por enquanto, cole o texto.
            </span>
          )}
        </div>

        <div
          role="tabpanel"
          id={panelId(PREFIX)}
          aria-labelledby={tabId(PREFIX, inputType)}
          className="analysis-form__fields"
        >
          {inputType === 'text' ? (
            <TextAreaField
              ref={/** @type {import('react').Ref<HTMLTextAreaElement>} */ (fieldRef)}
              name="texto"
              label="Texto da notícia ou mensagem"
              hint={`Entre ${formatNumber(TEXT_LIMITS.min)} e ${formatNumber(TEXT_LIMITS.max)} caracteres`}
              placeholder="Cole aqui a notícia ou a mensagem que você quer conferir…"
              value={text}
              invalid={Boolean(shownError && errorField === 'text')}
              describedBy={describedBy || undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                run.setDraft({ text: event.target.value })
                clearErrors()
              }}
            />
          ) : (
            <TextField
              ref={/** @type {import('react').Ref<HTMLInputElement>} */ (fieldRef)}
              name="endereco"
              type="url"
              inputMode="url"
              label="Endereço completo da notícia"
              hint="Apenas http:// ou https://"
              placeholder="https://exemplo.com/noticia"
              value={url}
              invalid={Boolean(shownError && errorField === 'url')}
              describedBy={describedBy || undefined}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                run.setDraft({ url: event.target.value })
                clearErrors()
              }}
            />
          )}
        </div>

        {inputType === 'text' ? (
          <div className="analysis-form__meta">
            <button type="button" className="text-action" onClick={fillExample}>
              Sem um conteúdo agora? Testar com um exemplo
            </button>
            <span id={counterId} className={over ? 'field-counter field-counter--over' : 'field-counter'}>
              {formatNumber(length)} / {formatNumber(TEXT_LIMITS.max)}
              {over ? ` · ${formatNumber(length - TEXT_LIMITS.max)} a mais` : ''}
            </span>
          </div>
        ) : null}

        {shownError ? (
          <ErrorPanel
            error={shownError}
            messageId={alertId}
            focusOnMount={!errorField}
            busy={run.phase === 'running'}
            onAction={handleErrorAction}
          />
        ) : null}

        <div className="analysis-form__bottom">
          <UsageMeter />
          <Button type="submit" variant="gold" icon="search" iconEnd="arrow">
            Verificar agora
          </Button>
        </div>
      </form>

      <LimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} />
    </div>
  )
}
