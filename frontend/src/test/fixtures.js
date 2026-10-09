// Respostas de exemplo no formato REAL da API v1 (verificAI, commit 63a0382):
// AnalysisResultSerializer, errors.py e as mensagens do back end.
// Servem para testes de contrato do RF29. Nenhum dado aqui é usado na aplicação em produção.

export const RECOMMENDATIONS = [
  'Procure a fonte original da informação antes de compartilhar.',
  'Compare com veículos de imprensa e agências de checagem reconhecidas.',
  'Verifique a data de publicação e se o conteúdo não está fora de contexto.',
  'Evite compartilhar enquanto houver dúvida sobre a veracidade.',
]

export const BASE_LIMITATIONS = [
  'O resultado é um apoio à avaliação e não substitui a verificação em fontes confiáveis.',
  'O índice de risco é um indicador e não representa a probabilidade de a notícia ser falsa.',
  'A consulta a fontes externas ainda não está habilitada; nenhuma evidência foi verificada.',
  'A confiança do modelo ainda não foi calibrada em dados independentes.',
]

const ID = '7b0f7a48-2f0d-4c64-9a36-3e1d3a0c5a11'

/** @param {Record<string, unknown>} [overrides] */
export function makeApiAnalysis(overrides = {}) {
  return {
    id: ID,
    api_version: 'v1',
    created_at: '2026-10-08T11:53:00.000000Z',
    input_type: 'text',
    status: { code: 'requer_atencao', label: 'Requer atenção' },
    risk_index: 48.31,
    claim: {
      summary: 'Todas as linhas de ônibus deixarão de funcionar no próximo domingo.',
      confirmed_by_user: false,
    },
    explanation: [
      'O padrão de escrita do texto se parece com o de notícias falsas vistas no treinamento do modelo.',
      'Foram encontradas expressões apelativas: “urgente”, “compartilhe”.',
      'Esses indicadores de linguagem são apenas sinais auxiliares e não provam que a notícia é falsa.',
    ],
    abstention: [],
    evidence: { enabled: false, sources: [] },
    indicators: {
      signal: 0.41,
      caps_ratio: 0.08,
      exclamations: 3,
      repeated_punctuation: 1,
      sensational_terms: ['urgente', 'compartilhe'],
      components: { caps: 0.27, punctuation: 0.5, terms: 0.67 },
    },
    model: {
      label: 'falsa',
      fake_probability: 0.62,
      confidence: 0.86,
      calibrated: false,
      chunks_analyzed: 1,
      chunks_total: 1,
      chunk_fake_probabilities: [0.62],
      chunk_disagreement: 0,
      tokens_analyzed: 74,
      tokens_total: 74,
      fully_analyzed: true,
      aggregation: 'mean',
      latency_ms: 812.4,
      device: 'cpu',
    },
    risk: {
      value: 48.31,
      signals_used: { model_fake_probability: 0.62, linguistic_indicators: 0.41 },
      signals_missing: ['evidence_conflict'],
      weights: { model_fake_probability: 0.6, linguistic_indicators: 0.15, evidence_conflict: 0.25 },
      formula: '100 * sum(w_i * s_i) / sum(w_i)',
    },
    limitations: BASE_LIMITATIONS,
    recommendations: RECOMMENDATIONS,
    versions: {
      model: 'bertimbau-fakenews-v4',
      model_sha256: 'a'.repeat(64),
      rules: 'rules-v1.0.0',
      calibrator: 'identity-v0',
      schema: '1.0',
      code: '63a0382',
    },
    duration_ms: 1204.7,
    ...overrides,
  }
}

export const apiLow = () =>
  makeApiAnalysis({
    status: { code: 'poucos_sinais_de_risco', label: 'Poucos sinais de risco' },
    risk_index: 18.4,
    claim: { summary: 'Biblioteca municipal anuncia programação de leitura para sábado.', confirmed_by_user: false },
  })

export const apiHigh = () =>
  makeApiAnalysis({
    status: { code: 'alto_risco', label: 'Alto risco' },
    risk_index: 88.1,
    claim: { summary: 'Órgão público confirma que todos receberão R$ 5.000 amanhã.', confirmed_by_user: false },
  })

export const apiInconclusive = () =>
  makeApiAnalysis({
    status: { code: 'analise_inconclusiva', label: 'Análise inconclusiva' },
    risk_index: null,
    abstention: [
      {
        code: 'low_confidence',
        message: 'O modelo não teve segurança estatística suficiente para indicar um nível de risco.',
      },
    ],
    explanation: ['O modelo não teve segurança estatística suficiente para indicar um nível de risco.'],
    claim: { summary: 'Ouvi dizer que a praça do bairro será fechada para obras.', confirmed_by_user: false },
  })

/** @param {Record<string, unknown>} fields */
export function makeApiError(fields) {
  return { error: { code: 'error', message: 'Erro.', action: 'Tente novamente.', field: null, ...fields } }
}

// Erros reais do back end (errors.py, preprocessing.py, views.py).
export const apiErrors = {
  textTooShort: makeApiError({
    code: 'text_too_short',
    message: 'O conteúdo tem 12 caracteres; o mínimo é 50.',
    action: 'Acrescente mais contexto, como o parágrafo completo da notícia.',
    field: 'text',
    details: { length: 12, min_chars: 50 },
  }),
  textTooLong: makeApiError({
    code: 'text_too_long',
    message: 'O conteúdo tem 5320 caracteres; o máximo é 5000.',
    action: 'Envie apenas o trecho com a alegação principal (até 5.000 caracteres).',
    field: 'text',
    details: { length: 5320, max_chars: 5000 },
  }),
  emptyInput: makeApiError({
    code: 'empty_input',
    message: 'O texto enviado está vazio.',
    action: 'Cole o conteúdo da notícia no campo de texto.',
    field: 'text',
  }),
  unreadable: makeApiError({
    code: 'unreadable_input',
    message: 'O conteúdo parece corrompido ou não contém texto suficiente.',
    action: 'Verifique se o texto foi colado corretamente.',
    field: 'text',
  }),
  unsupportedLanguage: makeApiError({
    code: 'unsupported_language',
    message: 'O conteúdo não parece estar em português.',
    action: 'O Fake Eyes analisa apenas notícias em português. Envie um texto em português.',
    field: 'text',
  }),
  urlUnavailable: makeApiError({
    code: 'url_input_unavailable',
    message: 'A análise por endereço (URL) ainda não está disponível nesta versão.',
    action: 'Cole o texto da notícia e selecione a opção de texto.',
    field: 'url',
  }),
  analysisUnavailable: makeApiError({
    code: 'analysis_unavailable',
    message: 'Não foi possível concluir a análise agora.',
    action: 'Tente novamente em alguns instantes.',
  }),
  notFound: makeApiError({
    code: 'analysis_not_found',
    message: 'Análise não encontrada.',
    action: 'Verifique o identificador informado.',
  }),
  throttled: makeApiError({
    code: 'throttled',
    message: 'Request was throttled. Expected available in 12 seconds.',
    action: 'Aguarde alguns instantes antes de tentar novamente.',
  }),
  validationUrl: makeApiError({
    code: 'validation_error',
    message: 'Informe o endereço da notícia.',
    action: 'Corrija os dados enviados e tente novamente.',
    field: 'url',
    details: { url: ['Informe o endereço da notícia.'] },
  }),
}
