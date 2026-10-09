import { useCallback, useEffect, useState } from 'react'
import { AppError } from '../domain/errors.js'
import { RequestCancelled } from '../services/http.js'
import { useServices } from '../state/services.jsx'

/**
 * @typedef {import('../domain/analysis.js').Analysis} Analysis
 * @typedef {{
 *   refresh: () => Promise<Analysis | null>,
 *   refreshing: boolean,
 * }} Refresh
 */

/**
 * Carrega o resultado de uma análise: primeiro do cache em memória (acabou de chegar) e, se não
 * estiver lá (página recarregada, link do histórico), de GET /api/v1/analyses/{id}/.
 *
 * "refresh" busca o resultado de novo no servidor, ignorando o cache. É o "tentar de novo" da
 * falha na consulta de fontes (RF27, cenário 6): a API guarda o resultado pelo identificador, e é
 * por esse acompanhamento (RF29) que uma atualização futura das fontes chegaria. Devolve a
 * análise nova ou null se a busca falhar (o resultado atual continua na tela).
 *
 * @param {string | undefined} id
 * @returns {({ status: 'loading' } | { status: 'ready', analysis: Analysis } | { status: 'error', error: AppError }) & Partial<Refresh>}
 */
export function useAnalysisResult(id) {
  const { analyses, results } = useServices()
  const [fetched, setFetched] = useState(
    /** @type {{ id: string, analysis?: Analysis, error?: AppError } | null} */ (null),
  )
  const [refreshing, setRefreshing] = useState(false)

  const cached = id ? results.get(id) : null

  useEffect(() => {
    if (!id || cached) return undefined
    const controller = new AbortController()
    analyses
      .get(id, { signal: controller.signal })
      .then((analysis) => {
        results.put(analysis)
        setFetched({ id, analysis })
      })
      .catch((error) => {
        if (error instanceof RequestCancelled) return
        setFetched({ id, error: error instanceof AppError ? error : new AppError({ scenario: 'unknown' }) })
      })
    return () => controller.abort()
  }, [id, cached, analyses, results])

  const refresh = useCallback(async () => {
    if (!id) return null
    setRefreshing(true)
    try {
      const analysis = await analyses.get(id)
      results.put(analysis)
      setFetched({ id, analysis })
      return analysis
    } catch {
      return null
    } finally {
      setRefreshing(false)
    }
  }, [id, analyses, results])

  if (cached) return { status: 'ready', analysis: cached, refresh, refreshing }
  if (fetched && fetched.id === id) {
    if (fetched.analysis) return { status: 'ready', analysis: fetched.analysis, refresh, refreshing }
    if (fetched.error) return { status: 'error', error: fetched.error }
  }
  return { status: 'loading' }
}
