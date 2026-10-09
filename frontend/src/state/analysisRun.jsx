import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppError } from '../domain/errors.js'
import { toHistoryItem } from '../domain/history.js'
import { RequestCancelled } from '../services/http.js'
import { useServices } from './services.jsx'
import { useToast } from './toast.jsx'

// Execução de uma análise (RF24, RF25, RNF01, RNF17).
//
// O estado fica ACIMA das páginas para que:
//  - trocar de página durante a espera não cancele nem duplique a análise;
//  - o rascunho (texto ou link digitado) sobreviva a erros e à navegação. Ele vive só na
//    memória da página: nunca vai para o armazenamento do navegador (RF05, privacidade).

/** @typedef {import('../services/analysesApi.js').AnalysisInput} AnalysisInput */
/** @typedef {{ inputType: 'text' | 'url', text: string, url: string }} Draft */
/**
 * @typedef {{
 *   draft: Draft,
 *   run: { phase: 'idle' | 'running' | 'failed', startedAt: number | null, error: AppError | null, input: AnalysisInput | null },
 * }} RunState
 */

/** @type {RunState} */
const initialState = {
  draft: { inputType: 'text', text: '', url: '' },
  run: { phase: 'idle', startedAt: null, error: null, input: null },
}

/**
 * @param {RunState} state
 * @param {{ type: string } & Record<string, any>} action
 * @returns {RunState}
 */
function reducer(state, action) {
  switch (action.type) {
    case 'draft':
      return { ...state, draft: { ...state.draft, ...action.patch } }
    case 'start':
      return { ...state, run: { phase: 'running', startedAt: action.at, error: null, input: action.input } }
    case 'succeeded':
      // Depois do resultado o formulário volta limpo: o texto não fica guardado em lugar nenhum.
      return { draft: { ...initialState.draft, inputType: state.draft.inputType }, run: initialState.run }
    case 'failed':
      return { ...state, run: { phase: 'failed', startedAt: null, error: action.error, input: state.run.input } }
    case 'idle':
      return { ...state, run: initialState.run }
    default:
      return state
  }
}

/**
 * @typedef {{
 *   draft: Draft,
 *   phase: 'idle' | 'running' | 'failed',
 *   startedAt: number | null,
 *   error: AppError | null,
 *   input: AnalysisInput | null,
 *   setDraft: (patch: Partial<Draft>) => void,
 *   start: (input: AnalysisInput) => Promise<{ started: boolean, reason?: 'busy' | 'limit' }>,
 *   retry: () => Promise<{ started: boolean, reason?: 'busy' | 'limit' }>,
 *   cancel: () => void,
 *   dismissError: () => void,
 * }} AnalysisRun
 */

const RunContext = createContext(/** @type {AnalysisRun | null} */ (null))

/** @param {{ children: import('react').ReactNode }} props */
export function AnalysisRunProvider({ children }) {
  const services = useServices()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [state, dispatch] = useReducer(reducer, initialState)

  const controllerRef = useRef(/** @type {AbortController | null} */ (null))
  const busyRef = useRef(false)
  const pathRef = useRef(location.pathname)
  const stateRef = useRef(state)
  useEffect(() => {
    pathRef.current = location.pathname
    stateRef.current = state
  })
  // Fechar a aplicação durante uma análise cancela a requisição.
  useEffect(() => () => controllerRef.current?.abort(), [])

  const setDraft = useCallback((/** @type {Partial<Draft>} */ patch) => dispatch({ type: 'draft', patch }), [])

  const start = useCallback(
    async (/** @type {AnalysisInput} */ input) => {
      // RF25: enquanto há uma solicitação ativa, nenhum envio duplicado.
      if (busyRef.current) return { started: false, reason: /** @type {const} */ ('busy') }

      const signedIn = services.auth?.getSnapshot().signedIn ?? false
      // RF33: a quarta tentativa na janela não inicia processamento.
      if (!signedIn && !services.visitorLimit.canStart()) {
        return { started: false, reason: /** @type {const} */ ('limit') }
      }

      busyRef.current = true
      const controller = new AbortController()
      controllerRef.current = controller
      // Confirmação visual imediata (RNF17: em até 1 s): o estado muda no mesmo clique.
      dispatch({ type: 'start', input, at: services.now() })

      try {
        const analysis = await services.analyses.create(input, { signal: controller.signal })
        services.results.put(analysis)
        // RF33: só conta quem termina com resultado ou análise inconclusiva.
        if (!signedIn) services.visitorLimit.registerCounted()
        services.history.add(toHistoryItem(analysis))
        const target = `/resultado/${analysis.id}`
        if (pathRef.current === '/') {
          // O roteador troca de página dentro de uma transição. Limpar o formulário na mesma transição
          // evita um instante com a tela inicial vazia entre a espera e o resultado.
          startTransition(() => {
            dispatch({ type: 'succeeded' })
            navigate(target)
          })
        } else {
          dispatch({ type: 'succeeded' })
          // A pessoa saiu da tela inicial durante a espera: não mudamos a página por ela.
          toast.show({
            message: 'Sua análise terminou.',
            tone: 'success',
            action: { label: 'Ver resultado', to: target },
            persistent: true,
          })
        }
      } catch (error) {
        if (error instanceof RequestCancelled) {
          dispatch({ type: 'idle' })
        } else {
          dispatch({ type: 'failed', error: error instanceof AppError ? error : new AppError({ scenario: 'unknown' }) })
        }
      } finally {
        busyRef.current = false
        controllerRef.current = null
      }
      return { started: true }
    },
    [services, navigate, toast],
  )

  const retry = useCallback(async () => {
    const input = stateRef.current.run.input
    if (!input) return { started: false }
    return start(input)
  }, [start])

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const dismissError = useCallback(() => dispatch({ type: 'idle' }), [])

  const value = useMemo(
    () => ({
      draft: state.draft,
      phase: state.run.phase,
      startedAt: state.run.startedAt,
      error: state.run.error,
      input: state.run.input,
      setDraft,
      start,
      retry,
      cancel,
      dismissError,
    }),
    [state, setDraft, start, retry, cancel, dismissError],
  )

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

export function useAnalysisRun() {
  const value = useContext(RunContext)
  if (!value) throw new Error('AnalysisRunProvider ausente.')
  return value
}
