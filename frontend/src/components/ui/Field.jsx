import { useId, useState } from 'react'
import Icon from './Icon.jsx'

// Campos de formulário (Wroblewski, "Web Form Design"): rótulo sempre visível e acima do campo,
// ajuda e erro ligados ao campo por aria-describedby, erro escrito (nunca só cor), e nenhum
// bloqueio de colar (WCAG 3.3.8). A validação acontece no envio, não a cada tecla.

/** @param {string | undefined} id */
function useFieldIds(id) {
  const auto = useId()
  const base = id ?? `campo-${auto.replace(/:/g, '')}`
  return { inputId: base, hintId: `${base}-dica`, errorId: `${base}-erro` }
}

/** @param {(string | false | null | undefined)[]} ids */
const join = (ids) => ids.filter(Boolean).join(' ') || undefined

/**
 * Estrutura comum: rótulo, dica, controle e mensagem de erro.
 * @param {{
 *   label: string,
 *   hint?: string,
 *   error?: string,
 *   labelHidden?: boolean,
 *   ids: { inputId: string, hintId: string, errorId: string },
 *   children: import('react').ReactNode,
 * }} props
 */
function Shell({ label, hint, error, labelHidden = false, ids, children }) {
  return (
    <div className="field">
      <div className="field__head">
        <label className={labelHidden ? 'sr-only' : 'field__label'} htmlFor={ids.inputId}>
          {label}
        </label>
        {hint && !labelHidden ? (
          <span id={ids.hintId} className="field__hint">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={ids.errorId} className="field__error">
          <Icon name="info" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   label: string,
 *   hint?: string,
 *   error?: string,
 *   invalid?: boolean,
 *   labelHidden?: boolean,
 *   id?: string,
 *   describedBy?: string,
 *   ref?: import('react').Ref<HTMLInputElement>,
 * } & Omit<import('react').InputHTMLAttributes<HTMLInputElement>, 'id'>} props
 */
export function TextField({ label, hint, error, invalid, labelHidden, id, describedBy, ref, className, ...rest }) {
  const ids = useFieldIds(id)
  return (
    <Shell label={label} hint={hint} error={error} labelHidden={labelHidden} ids={ids}>
      <input
        ref={ref}
        id={ids.inputId}
        className={className ? `input ${className}` : 'input'}
        aria-invalid={error || invalid ? 'true' : undefined}
        aria-describedby={join([hint && !labelHidden && ids.hintId, error && ids.errorId, describedBy])}
        {...rest}
      />
    </Shell>
  )
}

/**
 * Área de texto. Não usa "maxlength" de propósito: o navegador cortaria o que a pessoa colou sem
 * avisar, e o RF01 proíbe corte silencioso. O limite é mostrado e validado por escrito.
 * @param {{
 *   label: string,
 *   hint?: string,
 *   error?: string,
 *   invalid?: boolean,
 *   id?: string,
 *   describedBy?: string,
 *   ref?: import('react').Ref<HTMLTextAreaElement>,
 * } & Omit<import('react').TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'maxLength'>} props
 */
export function TextAreaField({ label, hint, error, invalid, id, describedBy, ref, ...rest }) {
  const ids = useFieldIds(id)
  return (
    <Shell label={label} hint={hint} error={error} ids={ids}>
      <textarea
        ref={ref}
        id={ids.inputId}
        className="input textarea"
        aria-invalid={error || invalid ? 'true' : undefined}
        aria-describedby={join([hint && ids.hintId, error && ids.errorId, describedBy])}
        {...rest}
      />
    </Shell>
  )
}

/**
 * Senha com botão de mostrar/ocultar. O nome do botão não muda; quem muda é o estado
 * (aria-pressed), para o leitor de tela não anunciar duas vezes.
 * @param {{
 *   label: string,
 *   hint?: string,
 *   error?: string,
 *   id?: string,
 *   ref?: import('react').Ref<HTMLInputElement>,
 * } & Omit<import('react').InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>} props
 */
export function PasswordField({ label, hint, error, id, ref, ...rest }) {
  const ids = useFieldIds(id)
  const [visible, setVisible] = useState(false)
  return (
    <Shell label={label} hint={hint} error={error} ids={ids}>
      <div className="password">
        <input
          ref={ref}
          id={ids.inputId}
          className="input"
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={join([hint && ids.hintId, error && ids.errorId])}
          {...rest}
        />
        <button
          type="button"
          className="icon-btn icon-btn--plain password__toggle"
          aria-label="Mostrar senha"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      </div>
    </Shell>
  )
}

/**
 * Caixa de seleção com a linha inteira clicável.
 * @param {{
 *   error?: string,
 *   id?: string,
 *   children: import('react').ReactNode,
 *   ref?: import('react').Ref<HTMLInputElement>,
 * } & Omit<import('react').InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>} props
 */
export function CheckboxField({ error, id, children, ref, ...rest }) {
  const ids = useFieldIds(id)
  return (
    <div className="field">
      <label className="check" htmlFor={ids.inputId}>
        <input
          ref={ref}
          id={ids.inputId}
          type="checkbox"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={join([error && ids.errorId])}
          {...rest}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={ids.errorId} className="field__error">
          <Icon name="info" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

/**
 * Chave liga/desliga. O estado aparece também por escrito ("Ligado"/"Desligado"), depois da chave:
 * o texto do rótulo vem primeiro, como numa linha de configuração. O estado escrito fica fora do nome
 * acessível (aria-hidden): o leitor de tela já anuncia "ligado/desligado" pelo papel "switch".
 * @param {{
 *   label: string,
 *   checked: boolean,
 *   onChange: (checked: boolean) => void,
 *   id?: string,
 *   describedBy?: string,
 * }} props
 */
export function SwitchField({ label, checked, onChange, id, describedBy }) {
  const ids = useFieldIds(id)
  return (
    <label className="switch" htmlFor={ids.inputId}>
      <span className="switch__label">{label}</span>
      <input
        id={ids.inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__state" aria-hidden="true">
        {checked ? 'Ligado' : 'Desligado'}
      </span>
    </label>
  )
}
