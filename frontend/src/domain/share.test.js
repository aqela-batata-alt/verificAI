import { describe, expect, it } from 'vitest'
import { apiInconclusive, makeApiAnalysis } from '../test/fixtures.js'
import { normalizeAnalysis } from './analysis.js'
import { buildShareSummary } from './share.js'

describe('resumo copiável (RF18)', () => {
  const attention = normalizeAnalysis(makeApiAnalysis())

  it('inclui status, alegação, data, limitações e a ressalva de que não houve verificação humana', () => {
    const text = buildShareSummary(attention)
    expect(text).toMatch(/Status: Requer atenção/)
    expect(text).toMatch(/Alegação analisada: “Todas as linhas de ônibus/)
    expect(text).toMatch(/Data da análise: 08\/10\/2026 08:53/)
    expect(text).toMatch(/Limitações:\n- O resultado é um apoio à avaliação/)
    expect(text).toMatch(/Não houve verificação humana/)
  })

  it('nunca afirma que o sistema fez verificação humana', () => {
    const text = buildShareSummary(attention).toLowerCase()
    expect(text).not.toMatch(/verificad[ao] por (humanos|pessoas|jornalistas)/)
    expect(text).not.toMatch(/checad[ao] por/)
  })

  it('descreve o índice como indicador, não como probabilidade nem certeza', () => {
    const text = buildShareSummary(attention)
    expect(text).toMatch(/Índice de risco: 48,31 de 100/)
    expect(text).toMatch(/não a probabilidade de a notícia ser falsa/)
  })

  it('sem fontes, diz que nenhuma fonte foi consultada (sem inventar)', () => {
    expect(buildShareSummary(attention)).toMatch(/Fontes: nenhuma fonte foi consultada ou apresentada/)
  })

  it('com fontes, lista veículo, título, relação e o link', () => {
    const withSources = normalizeAnalysis(
      makeApiAnalysis({
        evidence: {
          enabled: true,
          sources: [
            { relation: 'conflicting', publisher: 'Agência Exemplo', title: 'Checagem 123', url: 'https://exemplo.org/c/123' },
            { relation: 'contextual', title: 'Sem veículo', url: 'javascript:alert(1)' },
          ],
        },
      }),
    )
    const text = buildShareSummary(withSources)
    expect(text).toMatch(/- Agência Exemplo: Checagem 123 \(conflitante com a alegação\) https:\/\/exemplo\.org\/c\/123/)
    expect(text).toMatch(/- Sem veículo \(traz contexto\)$/m)
    expect(text).not.toMatch(/javascript:/)
  })

  it('análise inconclusiva não vira conclusão definitiva e traz os motivos', () => {
    const text = buildShareSummary(normalizeAnalysis(apiInconclusive()))
    expect(text).toMatch(/Status: Análise inconclusiva/)
    expect(text).toMatch(/Índice de risco: não calculado/)
    expect(text).toMatch(/não chegou a uma conclusão/)
    expect(text).toMatch(/não use este resumo para afirmar que a notícia é verdadeira nem que é falsa/i)
    expect(text).toMatch(/- O modelo não teve segurança estatística suficiente/)
    expect(text).not.toMatch(/Índice de risco: \d/)
  })

  it('usa o nome do produto recebido', () => {
    expect(buildShareSummary(attention, { productName: 'Apura' }).startsWith('Apura: resumo')).toBe(true)
  })
})
