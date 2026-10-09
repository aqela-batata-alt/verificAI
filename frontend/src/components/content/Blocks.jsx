/**
 * Desenha os blocos de texto dos módulos de conteúdo (src/content): parágrafos e listas.
 * O texto fica em módulos separados porque ele precisa ser conferido contra o que o sistema faz
 * (RF30), e os testes de conteúdo leem esses módulos direto.
 *
 * A posição serve de chave porque a lista é fixa: nunca é reordenada nem filtrada.
 *
 * @param {{ blocks: ReadonlyArray<import('../../content/how.js').Block> }} props
 */
export default function Blocks({ blocks }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.type === 'ul' ? (
          <ul key={index}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{block.text}</p>
        ),
      )}
    </>
  )
}
