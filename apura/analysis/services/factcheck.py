"""
Serviço de checagem externa de fatos (RF07, RF08).

Integra a API Google Fact Check Tools (ClaimReview) com fallback inteligente
para checagens de agências brasileiras (Aos Fatos, Agência Lupa, G1 Fato ou Fake,
Boatos.org, E-farsas, UOL Confere).
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from typing import Any

import requests
from bs4 import BeautifulSoup
from django.conf import settings

logger = logging.getLogger(__name__)

GOOGLE_FACTCHECK_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

KNOWN_PUBLISHERS = {
    "g1.globo.com": "G1 Fato ou Fake",
    "aosfatos.org": "Aos Fatos",
    "lupa.uol.com.br": "Agência Lupa",
    "boatos.org": "Boatos.org",
    "e-farsas.com": "E-farsas",
    "noticias.uol.com.br/confere": "UOL Confere",
    "estadao.com.br/estadao-verifica": "Estadão Verifica",
}


def _extract_query_keywords(claim_text: str, max_words: int = 8) -> str:
    """Extrai as palavras mais significativas da alegação para busca."""
    # Remove pontuação desnecessária
    clean = re.sub(r"[^\w\s]", " ", claim_text, flags=re.UNICODE)
    words = clean.split()
    # Remove stopwords comuns em português para busca mais precisa
    stopwords = {
        "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das",
        "em", "no", "na", "nos", "nas", "para", "por", "com", "que", "se", "nao", "não",
        "e", "ou", "mas", "como", "ao", "aos", "pelo", "pela", "pelos", "pelas", "este",
        "esta", "esse", "essa", "isso", "isto", "urgente", "compartilhe", "veja", "foto",
    }
    keywords = [w for w in words if len(w) > 2 and w.lower() not in stopwords]
    if not keywords:
        keywords = words[:max_words]
    return " ".join(keywords[:max_words])


def _search_google_fact_check(query: str, api_key: str) -> list[dict[str, Any]]:
    """Consulta a API oficial do Google Fact Check Tools."""
    params = {
        "query": query,
        "languageCode": "pt-BR",
        "pageSize": 5,
        "key": api_key,
    }
    try:
        resp = requests.get(GOOGLE_FACTCHECK_URL, params=params, timeout=6)
        if resp.status_code != 200:
            logger.warning("Google Fact Check API retornou status %s", resp.status_code)
            return []
        data = resp.json()
        claims = data.get("claims") or []
        results: list[dict[str, Any]] = []

        for i, claim_item in enumerate(claims):
            claim_text = claim_item.get("text", "")
            for review in claim_item.get("claimReview", []):
                publisher_info = review.get("publisher", {})
                publisher_name = publisher_info.get("name") or "Agência de Checagem"
                title = review.get("title") or claim_text
                rating = (review.get("textualRating") or "").strip()
                review_url = review.get("url") or ""
                review_date = review.get("reviewDate") or claim_item.get("claimDate")

                rating_lower = rating.lower()
                if any(w in rating_lower for w in ("falso", "fake", "enganoso", "distorcido", "mentira", "inverdade", "incorreto")):
                    relation = "conflicting"
                    reason = f"Classificado como '{rating}' pela checagem oficial."
                elif any(w in rating_lower for w in ("verdadeiro", "fato", "correto", "real")):
                    relation = "compatible"
                    reason = f"Classificado como '{rating}' pela checagem oficial."
                else:
                    relation = "contextual"
                    reason = f"Traz contexto ou avaliação parcial ('{rating}')."

                results.append({
                    "id": f"gfc-{i + 1}",
                    "relation": relation,
                    "publisher": publisher_name,
                    "title": title,
                    "excerpt": f"Alegação: {claim_text}. Veredito da checagem: {rating}." if rating else claim_text,
                    "published_at": review_date,
                    "url": review_url,
                    "relation_reason": reason,
                })

        return results
    except Exception:
        logger.exception("Falha ao consultar Google Fact Check API")
        return []


def _search_fact_check_fallback(query: str) -> list[dict[str, Any]]:
    """
    Fallback: Busca em checagens públicas brasileiras quando a chave
    da Google API não estiver definida.
    """
    search_term = f"{query} checagem fato fake"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(search_term)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        results: list[dict[str, Any]] = []

        for i, el in enumerate(soup.select(".result")[:6]):
            link_el = el.select_one(".result__url")
            title_el = el.select_one(".result__title")
            snippet_el = el.select_one(".result__snippet")

            if not link_el or not title_el:
                continue

            raw_link = link_el.get_text(strip=True)
            title = title_el.get_text(strip=True)
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            # Identifica se é veículo de checagem conhecido
            publisher = "Agência de Notícias / Checagem"
            for domain, name in KNOWN_PUBLISHERS.items():
                if domain in raw_link.lower() or domain in title.lower():
                    publisher = name
                    break

            # Determina a relação a partir do título
            title_lower = title.lower()
            snippet_lower = snippet.lower()
            if any(w in title_lower or w in snippet_lower for w in ("é falso", "é fake", "não é verdade", "boato", "engana", "distorce", "desment")):
                relation = "conflicting"
                reason = "A apuração jornalística indica que a alegação é falsa ou enganosa."
            elif any(w in title_lower or w in snippet_lower for w in ("é fato", "é verdade", "verdadeiro", "confirma")):
                relation = "compatible"
                reason = "A apuração indica que os fatos relatados são verídicos."
            else:
                relation = "contextual"
                reason = "Publicação com cobertura contextual relacionada ao tema."

            # Extrai link real
            href = ""
            a_tag = el.select_one("a.result__url") or el.select_one("a.result__snippet") or el.select_one(".result__title a")
            if a_tag and a_tag.get("href"):
                href = str(a_tag["href"])
                if "uddg=" in href:
                    href = urllib.parse.unquote(href.split("uddg=")[-1].split("&")[0])

            results.append({
                "id": f"src-{i + 1}",
                "relation": relation,
                "publisher": publisher,
                "title": title,
                "excerpt": snippet,
                "published_at": None,
                "url": href or f"https://{raw_link}",
                "relation_reason": reason,
            })

            if len(results) >= 4:
                break

        return results
    except Exception:
        logger.exception("Falha no fallback de checagem de fatos")
        return []


def search_fact_checks(claim_or_title: str) -> dict[str, Any]:
    """
    Busca checagens de fatos para a notícia ou alegação.
    Retorna estrutura padronizada para o serializer e pipeline:
    {
        "status": "found" | "none",
        "enabled": True,
        "sources": [...],
        "conflict_score": 1.0 | 0.0 | None
    }
    """
    if not claim_or_title or len(claim_or_title.strip()) < 5:
        return {"status": "none", "enabled": True, "sources": [], "conflict_score": None}

    query = _extract_query_keywords(claim_or_title)
    api_key = settings.FAKE_EYES.get("GOOGLE_FACT_CHECK_API_KEY", "")

    sources: list[dict[str, Any]] = []

    # 1. Tenta a API oficial do Google Fact Check se a chave estiver configurada
    if api_key:
        sources = _search_google_fact_check(query, api_key)

    # 2. Se não houver chave ou a API retornar vazio, utiliza o fallback
    if not sources:
        sources = _search_fact_check_fallback(query)

    # Avaliação do conflito de evidências (RF08)
    has_conflicting = any(s.get("relation") == "conflicting" for s in sources)
    has_compatible = any(s.get("relation") == "compatible" for s in sources)

    conflict_score: float | None = None
    if has_conflicting:
        conflict_score = 1.0  # Conflitante com a alegação analisada
    elif has_compatible:
        conflict_score = 0.0  # Compatível com a alegação analisada

    return {
        "status": "found" if sources else "none",
        "enabled": True,
        "sources": sources,
        "conflict_score": conflict_score,
    }
