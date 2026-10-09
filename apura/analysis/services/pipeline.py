"""
Orquestração do fluxo de análise (Etapa 1: entrada por texto).

validação → normalização → classificação → indicadores → risco → abstenção →
persistência sem texto bruto → resposta.
"""

from __future__ import annotations

import logging
import subprocess
import time
from functools import lru_cache

from django.conf import settings

from ..models import Analysis
from . import risk
from .classifier import get_classifier
from .preprocessing import NewsInput, build_news_input, summarize_claim

logger = logging.getLogger(__name__)

SCHEMA_VERSION = "1.0"


@lru_cache(maxsize=1)
def code_version() -> str:
    configured = settings.FAKE_EYES.get("CODE_VERSION")
    if configured:
        return configured
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=settings.REPO_DIR,
            stderr=subprocess.DEVNULL, timeout=2,
        ).decode().strip()
    except Exception:  # noqa: BLE001 — ausência de git não deve derrubar a análise
        return "desconhecido"


def _limitations(news: NewsInput, cls, rules: risk.Rules, evidence_enabled: bool) -> list[str]:
    items = [
        "O resultado é um apoio à avaliação e não substitui a verificação em fontes confiáveis.",
        "O índice de risco é um indicador e não representa a probabilidade de a notícia ser falsa.",
    ]
    if not evidence_enabled:
        items.append("A consulta a fontes externas ainda não está habilitada; nenhuma evidência foi verificada.")
    if not rules.calibrator.get("calibrated", False):
        items.append("A confiança do modelo ainda não foi calibrada em dados independentes.")
    if not cls.fully_analyzed:
        items.append("Parte do conteúdo não pôde ser analisada pelo modelo.")
    if news.title_inferred:
        items.append("O título foi identificado automaticamente a partir da primeira linha do texto.")
    elif not news.title:
        items.append("Nenhum título foi informado; o modelo analisou apenas o corpo do texto.")
    return items


def run_text_analysis(*, text: str, title: str = "", subtitle: str = "", user=None, visitor_id: str = "") -> Analysis:
    started = time.perf_counter()
    rules = risk.load_rules()
    news = build_news_input(text=text, title=title, subtitle=subtitle)

    classifier = get_classifier()
    temperature = float(rules.calibrator.get("temperature", 1.0))
    cls = classifier.classify(news.title, news.subtitle, news.body, temperature=temperature)

    ling = risk.linguistic_indicators(news.full_text, rules.linguistic)
    evidence_enabled = False  # Etapa 3
    signals = {
        "model_fake_probability": cls.fake_probability,
        "linguistic_indicators": ling["signal"],
        "evidence_conflict": None,  # ausente até a Etapa 3
    }
    risk_info = risk.compute_risk_index(signals, rules.weights)

    reasons = risk.abstention_reasons(
        rules=rules,
        model_confidence=cls.confidence,
        chunk_disagreement=cls.chunk_disagreement,
        evidence_available=None if not evidence_enabled else False,
    )
    if reasons or risk_info["value"] is None:
        status = risk.STATUS_INCONCLUSIVE
    else:
        status = risk.status_for_index(risk_info["value"], rules)

    technical = {
        "classification": cls.to_dict(),
        "linguistic_indicators": ling,
        "risk": risk_info,
        "rules": {
            "version": rules.version,
            "status_bands": {"low_max": rules.low_max, "attention_max": rules.attention_max},
            "abstention": {
                "min_model_confidence": rules.min_model_confidence,
                "max_chunk_disagreement": rules.max_chunk_disagreement,
                "require_evidence": rules.require_evidence,
            },
        },
        "calibrator": rules.calibrator,
        "evidence": {"enabled": evidence_enabled, "sources": []},
        "input": {
            "title_provided": bool(title.strip()),
            "title_inferred": news.title_inferred,
            "subtitle_provided": bool(news.subtitle),
            "characters": len(news.full_text),
        },
        "limitations": _limitations(news, cls, rules, evidence_enabled),
    }

    analysis = Analysis.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        visitor_id=visitor_id[:64],
        input_type=Analysis.InputType.TEXT,
        claim_summary=summarize_claim(news),
        status=status,
        risk_index=None if status == risk.STATUS_INCONCLUSIVE else risk_info["value"],
        abstention_reasons=reasons,
        model_label=cls.label,
        model_fake_probability=cls.fake_probability,
        model_confidence=cls.confidence,
        technical=technical,
        model_version=cls.model_version,
        model_sha256=cls.model_sha256,
        rules_version=rules.version,
        calibrator_version=str(rules.calibrator.get("version", "none")),
        schema_version=SCHEMA_VERSION,
        code_version=code_version(),
        duration_ms=round((time.perf_counter() - started) * 1000, 2),
    )
    # Log técnico sem texto bruto (RNF10)
    logger.info(
        "analysis id=%s status=%s risk=%s conf=%.3f chunks=%d ms=%.1f",
        analysis.id, status, analysis.risk_index, cls.confidence, cls.chunks_analyzed, analysis.duration_ms,
    )
    return analysis
