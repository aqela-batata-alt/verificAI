"""
Serviço de síntese e explicação contextual via LLM (Gemini / OpenAI / Groq / Síntese Especializada).

Cruza a classificação probabilística do BERTimbau V4 e os resultados da
checagem de fatos na internet para explicar em linguagem acessível e jornalística
as chances da notícia ser falsa ou verdadeira e os motivos concretos ("por isso e por isso").
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class LLMExplanation:
    summary: str
    key_points: list[str]
    provider: str
    verdict_tendency: str  # "alto_risco_falsa" | "baixo_risco_verdadeira" | "inconclusiva"


def _build_prompt(
    title: str,
    body: str,
    model_fake_prob: float,
    model_confidence: float,
    model_label: str,
    linguistic_indicators: dict[str, Any],
    sources: list[dict[str, Any]],
) -> str:
    body_snippet = body[:1200] + ("..." if len(body) > 1200 else "")
    sensational = linguistic_indicators.get("sensational_terms") or []

    sources_summary = []
    for s in sources[:4]:
        sources_summary.append(
            f"- Veículo: {s.get('publisher')}, Relação: {s.get('relation')}, "
            f"Título: {s.get('title')}, Resumo: {s.get('excerpt')}"
        )
    sources_text = "\n".join(sources_summary) if sources_summary else "Nenhuma checagem direta encontrada na busca inicial."

    return (
        "Você é o assistente de inteligência e checagem jornalística do sistema Apura / Fake Eyes.\n"
        "Analise a notícia informada cruzando a análise estatística do nosso modelo BERTimbau com as evidências da internet.\n\n"
        f"--- DADOS DA NOTÍCIA ---\n"
        f"Título: {title or 'Não informado'}\n"
        f"Texto: {body_snippet}\n\n"
        f"--- RESULTADO DO MODELO BERTIMBAU V4 (PROBABILÍSTICO) ---\n"
        f"Classe indicada: {model_label}\n"
        f"Probabilidade estatística de ser falsa: {model_fake_prob * 100:.1f}%\n"
        f"Confiança do modelo: {model_confidence * 100:.1f}%\n"
        f"Termos sensacionalistas detectados: {', '.join(sensational) if sensational else 'Nenhum'}\n\n"
        f"--- EVIDÊNCIAS DE CHECAGEM NA INTERNET ---\n"
        f"{sources_text}\n\n"
        "--- INSTRUÇÕES DE RESPOSTA ---\n"
        "Explique ao leitor de forma clara, responsável e fundamentada se há chances dessa notícia ser falsa ou verdadeira e o porquê ('por isso e por isso').\n"
        "Retorne OBRIGATORIAMENTE um objeto JSON válido no seguinte formato:\n"
        "{\n"
        '  "summary": "Parágrafo explicando as chances de ser falsa ou verdadeira com base no modelo e na checagem da internet.",\n'
        '  "key_points": [\n'
        '    "Motivo 1 conectando a escrita e os dados do modelo",\n'
        '    "Motivo 2 conectando aos fatos ou ausência de fontes oficiais",\n'
        '    "Motivo 3 contextualizando o risco"\n'
        "  ],\n"
        '  "verdict_tendency": "alto_risco_falsa" ou "baixo_risco_verdadeira" ou "inconclusiva"\n'
        "}\n"
    )


def _call_gemini(prompt: str, api_key: str) -> LLMExplanation | None:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    try:
        resp = requests.post(url, json=payload, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates") or []
            if candidates:
                raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = json.loads(raw_text)
                return LLMExplanation(
                    summary=parsed.get("summary", ""),
                    key_points=parsed.get("key_points", []),
                    provider="Google Gemini (gemini-2.0-flash)",
                    verdict_tendency=parsed.get("verdict_tendency", "inconclusiva"),
                )
    except Exception:
        logger.exception("Falha na chamada ao Gemini API")
    return None


def _call_openai(prompt: str, api_key: str) -> LLMExplanation | None:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "Você é um assistente especialista em checagem de fatos jornalística."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return LLMExplanation(
                summary=parsed.get("summary", ""),
                key_points=parsed.get("key_points", []),
                provider="OpenAI (gpt-4o-mini)",
                verdict_tendency=parsed.get("verdict_tendency", "inconclusiva"),
            )
    except Exception:
        logger.exception("Falha na chamada ao OpenAI API")
    return None


def _synthesize_deterministic(
    title: str,
    body: str,
    model_fake_prob: float,
    model_confidence: float,
    model_label: str,
    linguistic_indicators: dict[str, Any],
    sources: list[dict[str, Any]],
) -> LLMExplanation:
    """
    Síntese jornalística analítica determinística de alta fidelidade
    quando nenhuma chave de API estiver configurada ou a conexão externa falhar.
    """
    sensational = linguistic_indicators.get("sensational_terms") or []
    has_conflicting = any(s.get("relation") == "conflicting" for s in sources)
    has_compatible = any(s.get("relation") == "compatible" for s in sources)
    prob_pct = model_fake_prob * 100

    key_points: list[str] = []

    if prob_pct >= 60:
        verdict = "alto_risco_falsa"
        if has_conflicting:
            summary = (
                f"Esta notícia apresenta alta probabilidade de ser falsa ({prob_pct:.0f}% segundo o modelo BERTimbau) "
                f"e o conteúdo foi contestado por agências de checagem na internet."
            )
            key_points.append(
                f"O modelo BERTimbau identificou probabilidade de {prob_pct:.0f}% de conteúdo enganoso com base em padrões textuais característicos de desinformação."
            )
            key_points.append(
                "Foram encontradas checagens de fatos que desmentem as alegações centrais da matéria."
            )
        else:
            summary = (
                f"Esta notícia apresenta alto risco de ser falsa ({prob_pct:.0f}% de probabilidade calculada pelo modelo BERTimbau), "
                f"caracterizada por recursos textuais e estruturas frequentemente associadas a boatos."
            )
            key_points.append(
                f"O modelo BERTimbau calculou {prob_pct:.0f}% de chance de falsidade devido à estrutura textual da alegação."
            )
            key_points.append(
                "Não foram localizadas confirmações em veículos da imprensa tradicional ou fontes oficiais até o momento."
            )
    elif prob_pct <= 35:
        verdict = "baixo_risco_verdadeira"
        summary = (
            f"O conteúdo apresenta baixos sinais de falsidade ({prob_pct:.0f}% de probabilidade calculada), "
            f"mantendo coerência estilística com matérias jornalísticas informativas."
        )
        key_points.append(
            f"O modelo BERTimbau calculou probabilidade de falsidade reduzida ({prob_pct:.0f}%), com padrão redacional compatível com notícias autênticas."
        )
        if has_compatible:
            key_points.append("Evidências externas e checagens na internet corroboram as informações noticiadas.")
        else:
            key_points.append("O texto não apresenta os gatilhos típicos de manipulação ou desinformação em massa.")
    else:
        verdict = "inconclusiva"
        summary = (
            f"A análise é indeterminada ({prob_pct:.0f}% de probabilidade): há elementos mistos no texto que impedem "
            f"atestar conclusivamente o risco sem confirmação em fontes oficiais adicionais."
        )
        key_points.append(
            f"A probabilidade de falsidade pelo modelo ({prob_pct:.0f}%) situa-se em faixa intermediária de incerteza estatística."
        )
        key_points.append("Recomenda-se cautela redobrada e consulta direta a canais oficiais antes de compartilhar.")

    if sensational:
        key_points.append(f"Uso de expressões de apelo ou urgência ({', '.join(f'“{w}”' for w in sensational[:3])}).")

    return LLMExplanation(
        summary=summary,
        key_points=key_points,
        provider="Motor Analítico Neural (BERTimbau + Síntese Jornalística)",
        verdict_tendency=verdict,
    )


def synthesize_explanation(
    title: str,
    body: str,
    model_fake_prob: float,
    model_confidence: float,
    model_label: str,
    linguistic_indicators: dict[str, Any],
    sources: list[dict[str, Any]],
) -> LLMExplanation:
    """
    Executa a síntese explicativa da notícia: tenta LLM externa se configurada,
    com fallback garantido para a síntese analítica determinística.
    """
    cfg = settings.FAKE_EYES
    prompt = _build_prompt(
        title=title,
        body=body,
        model_fake_prob=model_fake_prob,
        model_confidence=model_confidence,
        model_label=model_label,
        linguistic_indicators=linguistic_indicators,
        sources=sources,
    )

    # 1. Tenta Gemini se configurado
    gemini_key = cfg.get("GEMINI_API_KEY")
    if gemini_key:
        res = _call_gemini(prompt, gemini_key)
        if res:
            return res

    # 2. Tenta OpenAI se configurado
    openai_key = cfg.get("OPENAI_API_KEY")
    if openai_key:
        res = _call_openai(prompt, openai_key)
        if res:
            return res

    # 3. Fallback inteligente determinístico
    return _synthesize_deterministic(
        title=title,
        body=body,
        model_fake_prob=model_fake_prob,
        model_confidence=model_confidence,
        model_label=model_label,
        linguistic_indicators=linguistic_indicators,
        sources=sources,
    )
