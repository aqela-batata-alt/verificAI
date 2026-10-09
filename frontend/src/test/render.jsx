import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createConfig } from '../config.js'
import { createServices } from '../services/index.js'
import { createStorage } from '../services/storage.js'
import { AnalysisRunProvider } from '../state/analysisRun.jsx'
import { ServicesProvider } from '../state/services.jsx'
import { ToastProvider } from '../state/toast.jsx'

/** Resposta JSON no formato de uma Response de verdade. */
export const jsonResponse = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })

/**
 * Serviços de teste: mesmo pacote da aplicação, com fetch falso e relógio controlável.
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   env?: Record<string, string>,
 *   clock?: { now: number },
 *   auth?: any,
 *   feedback?: any,
 *   storage?: ReturnType<typeof createStorage>,
 * }} [options]
 */
export function createTestServices({ fetchImpl, env = {}, clock, auth, feedback, storage } = {}) {
  const overrides = {
    config: createConfig({ VITE_API_BASE_URL: '/api', ...env }),
    storage: storage ?? createStorage(),
    fetchImpl,
    now: clock ? () => clock.now : undefined,
  }
  if (auth !== undefined) overrides.auth = auth
  if (feedback !== undefined) overrides.feedback = feedback
  return createServices(overrides)
}

/**
 * Renderiza dentro de roteador, serviços, avisos e execução de análise.
 * @param {import('react').ReactElement} ui
 * @param {{ route?: string, services?: ReturnType<typeof createTestServices> }} [options]
 */
export function renderWithApp(ui, { route = '/', services = createTestServices() } = {}) {
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <ServicesProvider services={services}>
        <ToastProvider>
          <AnalysisRunProvider>{ui}</AnalysisRunProvider>
        </ToastProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )
  return { ...result, services }
}
