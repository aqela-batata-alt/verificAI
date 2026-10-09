import { useEffect } from 'react'

export const PRODUCT_NAME = 'Apura'
export const DEFAULT_TITLE = `${PRODUCT_NAME} — Um segundo olhar sobre a notícia`

/**
 * Título da aba do navegador por página (WCAG 2.4.2). Sem título, volta ao padrão.
 * @param {string | undefined} title
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ${PRODUCT_NAME}` : DEFAULT_TITLE
  }, [title])
}
