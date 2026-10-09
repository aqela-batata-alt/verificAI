// @ts-check
// Normalização e contagem de texto espelhando o back end (preprocessing.normalize_text),
// para que o contador da interface mostre o mesmo número que a API vai validar (RF01).
// O servidor continua sendo a fonte da verdade: se discordar, a interface mostra o erro dele.

/**
 * Intervalos (em pontos de código) que o back end remove: controles C0 e C1 (menos tab,
 * quebra de linha e retorno), caracteres de largura zero e marcas de direção, separadores de
 * linha e de parágrafo do Unicode e a marca de ordem de bytes.
 * Os intervalos ficam em números, e não em "\uXXXX" no código, para que o arquivo continue
 * legível e à prova de ferramentas que reescrevem esses caracteres invisíveis.
 */
const CONTROL_RANGES = /** @type {const} */ ([
  [0x0000, 0x0008],
  [0x000b, 0x000c],
  [0x000e, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0xfeff, 0xfeff],
])

/** @param {number} code */
const escapeCode = (code) => `\\u${code.toString(16).padStart(4, '0')}`

const CONTROL_CHARS = new RegExp(
  `[${CONTROL_RANGES.map(([from, to]) => (from === to ? escapeCode(from) : `${escapeCode(from)}-${escapeCode(to)}`)).join('')}]`,
  'g',
)
const MULTI_SPACE = new RegExp(`[ \\t${escapeCode(0x00a0)}]+`, 'g')
const MULTI_NEWLINE = /\n{3,}/g

/**
 * Normaliza Unicode (NFC), remove caracteres de controle e espaços redundantes.
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text) return ''
  return String(text)
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(MULTI_SPACE, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(MULTI_NEWLINE, '\n\n')
    .trim()
}

/**
 * Conta caracteres como o back end (pontos de código, não unidades UTF-16).
 * @param {string} text texto já normalizado
 * @returns {number}
 */
export function countCharacters(text) {
  let count = 0
  for (const _char of text) count += 1
  return count
}
