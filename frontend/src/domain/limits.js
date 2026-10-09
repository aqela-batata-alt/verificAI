// @ts-check
// Constantes de regra de negócio. Cada uma aponta para o requisito (Requisitos v2.2) de onde vem.

/** RF01: tamanho do texto, em caracteres, depois da normalização. */
export const TEXT_LIMITS = Object.freeze({ min: 50, max: 5000 })

/** RF01 / API: tamanho máximo do endereço aceito pela API. */
export const URL_MAX_LENGTH = 2048

/** RF33: três análises em uma janela de 24 horas, por navegador. */
export const VISITOR_LIMIT = Object.freeze({ max: 3, windowMs: 24 * 60 * 60 * 1000 })

/** RNF01 e RNF17: resultado, análise inconclusiva ou erro controlado em até 30 s. */
export const RESPONSE_DEADLINE_MS = 30_000

/**
 * Teto técnico do histórico local. Não vem dos requisitos: existe porque o
 * localStorage tem cota. Ao passar do teto, os itens mais antigos saem.
 */
export const HISTORY_MAX_ITEMS = 100

/** RNF10: prazo máximo de guarda de comentários brutos de feedback. */
export const FEEDBACK_COMMENT_RETENTION_DAYS = 30

/** Tamanho máximo do comentário de feedback na interface (limite de interface, não de requisito). */
export const FEEDBACK_COMMENT_MAX_CHARS = 1000
