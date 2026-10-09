"""
Regras de decisão do Fake Eyes (RF10, RF13, RF14, RF16).

O índice de risco é um INDICADOR, não uma probabilidade de falsidade:

    índice = 100 * Σ(w_i * s_i) / Σ(w_i)     somente sobre sinais disponíveis

onde cada sinal s_i ∈ [0, 1] e os pesos w_i ≥ 0 somam 1 no arquivo de regras.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from django.conf import settings

STATUS_LOW = "poucos_sinais_de_risco"
STATUS_ATTENTION = "requer_atencao"
STATUS_HIGH = "alto_risco"
STATUS_INCONCLUSIVE = "analise_inconclusiva"

STATUS_LABELS = {
    STATUS_LOW: "Poucos sinais de risco",
    STATUS_ATTENTION: "Requer atenção",
    STATUS_HIGH: "Alto risco",
    STATUS_INCONCLUSIVE: "Análise inconclusiva",
}

# Motivos de abstenção (RF14) — mensagens distintas por motivo.
ABSTAIN_OUT_OF_SCOPE = "out_of_scope"
ABSTAIN_LOW_CONFIDENCE = "low_confidence"
ABSTAIN_SOURCE_CONFLICT = "source_conflict"
ABSTAIN_INSUFFICIENT_EVIDENCE = "insufficient_evidence"

ABSTENTION_MESSAGES = {
    ABSTAIN_OUT_OF_SCOPE: "O conteúdo está fora do escopo de notícias que o sistema consegue avaliar.",
    ABSTAIN_LOW_CONFIDENCE: "O modelo não teve segurança estatística suficiente para indicar um nível de risco.",
    ABSTAIN_SOURCE_CONFLICT: "As fontes encontradas apresentam informações conflitantes entre si.",
    ABSTAIN_INSUFFICIENT_EVIDENCE: "Não foram encontradas evidências suficientes sobre esta alegação.",
}


# --------------------------------------------------------------------------- #
# Regras versionadas
# --------------------------------------------------------------------------- #
class RulesError(ValueError):
    pass


@dataclass(frozen=True)
class Rules:
    version: str
    weights: dict[str, float]
    low_max: float
    attention_max: float
    min_model_confidence: float
    max_chunk_disagreement: float
    require_evidence: bool
    calibrator: dict
    linguistic: dict
    raw: dict = field(repr=False, compare=False, default_factory=dict)


def parse_rules(data: dict) -> Rules:
    weights = {k: float(v) for k, v in data["risk_weights"].items()}
    if any(w < 0 for w in weights.values()):
        raise RulesError("Pesos de risco não podem ser negativos.")
    if not math.isclose(sum(weights.values()), 1.0, abs_tol=1e-9):
        raise RulesError(f"Pesos de risco devem somar 1 (soma atual: {sum(weights.values())}).")
    bands = data["status_bands"]
    low_max, attention_max = float(bands["low_max"]), float(bands["attention_max"])
    if not 0 <= low_max < attention_max <= 100:
        raise RulesError("Faixas de status inválidas.")
    abst = data["abstention"]
    return Rules(
        version=data["version"],
        weights=weights,
        low_max=low_max,
        attention_max=attention_max,
        min_model_confidence=float(abst["min_model_confidence"]),
        max_chunk_disagreement=float(abst["max_chunk_disagreement"]),
        require_evidence=bool(abst.get("require_evidence", False)),
        calibrator=dict(data.get("calibrator", {})),
        linguistic=dict(data.get("linguistic", {})),
        raw=data,
    )


@lru_cache(maxsize=4)
def _load_rules_cached(path: str) -> Rules:
    return parse_rules(json.loads(Path(path).read_text(encoding="utf-8")))


def load_rules(path: str | None = None) -> Rules:
    return _load_rules_cached(path or settings.FAKE_EYES["RULES_FILE"])


# --------------------------------------------------------------------------- #
# Indicadores linguísticos (RF10) — sinais auxiliares, nunca prova isolada
# --------------------------------------------------------------------------- #
_WORDS = re.compile(r"\b[^\W\d_]+\b", re.UNICODE)


def _strip_accents_lower(text: str) -> str:
    import unicodedata

    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def linguistic_indicators(text: str, cfg: dict) -> dict:
    """Retorna indicadores individuais e um sinal agregado normalizado em [0, 1]."""
    words = _WORDS.findall(text)
    n_words = max(len(words), 1)
    long_words = [w for w in words if len(w) >= 3]
    caps_ratio = sum(w.isupper() for w in long_words) / max(len(long_words), 1)
    exclam = text.count("!")
    exclam_per_100 = exclam * 100 / n_words
    repeated_punct = len(re.findall(r"[!?]{2,}", text))

    norm = _strip_accents_lower(text)
    found_terms = sorted({t for t in cfg.get("sensational_terms", []) if _strip_accents_lower(t) in norm})

    caps_s = min(caps_ratio / float(cfg.get("caps_ratio_saturation", 0.3)), 1.0)
    excl_s = min((exclam_per_100 + repeated_punct) / float(cfg.get("exclamation_per_100_words_saturation", 3.0)), 1.0)
    terms_s = min(len(found_terms) / float(cfg.get("sensational_terms_saturation", 3)), 1.0)
    signal = (caps_s + excl_s + terms_s) / 3

    return {
        "signal": round(signal, 6),
        "caps_ratio": round(caps_ratio, 4),
        "exclamations": exclam,
        "repeated_punctuation": repeated_punct,
        "sensational_terms": found_terms,
        "components": {"caps": round(caps_s, 4), "punctuation": round(excl_s, 4), "terms": round(terms_s, 4)},
    }


# --------------------------------------------------------------------------- #
# Índice de risco (RF13) e faixas (RF16)
# --------------------------------------------------------------------------- #
def compute_risk_index(signals: dict[str, float | None], weights: dict[str, float]) -> dict:
    """
    Aplica a fórmula documentada. Sinais ``None`` ou não mapeados nos pesos são
    ignorados e registrados como ausentes.
    """
    used, missing = {}, []
    for name, weight in weights.items():
        value = signals.get(name)
        if value is None:
            missing.append(name)
            continue
        if not 0.0 <= float(value) <= 1.0:
            raise ValueError(f"Sinal '{name}' fora do intervalo [0, 1]: {value}")
        used[name] = float(value)

    weight_sum = sum(weights[n] for n in used)
    if not used or weight_sum == 0:
        return {"value": None, "signals_used": used, "signals_missing": missing,
                "weights": weights, "formula": "100 * sum(w_i * s_i) / sum(w_i)"}

    value = 100 * sum(weights[n] * s for n, s in used.items()) / weight_sum
    return {
        "value": round(value, 2),
        "signals_used": used,
        "signals_missing": missing,
        "weights": weights,
        "formula": "100 * sum(w_i * s_i) / sum(w_i)",
    }


def status_for_index(index: float, rules: Rules) -> str:
    """0 ≤ i ≤ low_max → baixo; low_max < i ≤ attention_max → atenção; > attention_max → alto."""
    if index <= rules.low_max:
        return STATUS_LOW
    if index <= rules.attention_max:
        return STATUS_ATTENTION
    return STATUS_HIGH


# --------------------------------------------------------------------------- #
# Abstenção (RF14)
# --------------------------------------------------------------------------- #
def abstention_reasons(
    *,
    rules: Rules,
    model_confidence: float | None,
    chunk_disagreement: float = 0.0,
    out_of_scope: bool = False,
    evidence_available: bool | None = None,
    sources_conflict: bool = False,
) -> list[str]:
    """
    Retorna os motivos de abstenção aplicáveis, em ordem de prioridade.
    ``evidence_available=None`` significa que a busca de evidências não está habilitada.
    """
    reasons: list[str] = []
    if out_of_scope:
        reasons.append(ABSTAIN_OUT_OF_SCOPE)
    if model_confidence is None or model_confidence < rules.min_model_confidence \
            or chunk_disagreement > rules.max_chunk_disagreement:
        reasons.append(ABSTAIN_LOW_CONFIDENCE)
    if sources_conflict:
        reasons.append(ABSTAIN_SOURCE_CONFLICT)
    if rules.require_evidence and not evidence_available:
        reasons.append(ABSTAIN_INSUFFICIENT_EVIDENCE)
    return reasons
