import logging
import os
import sys

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class AnalysisConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "analysis"
    verbose_name = "Análises Fake Eyes"

    def ready(self):
        # Carrega o modelo na inicialização do servidor (gunicorn/runserver),
        # evitando que a primeira requisição pague o custo de carregamento.
        if not settings.FAKE_EYES.get("WARMUP_ON_STARTUP"):
            return
        management_cmd = len(sys.argv) > 1 and sys.argv[1] not in {"runserver"} and "gunicorn" not in sys.argv[0]
        if management_cmd or (sys.argv[1:2] == ["runserver"] and os.environ.get("RUN_MAIN") != "true"):
            return
        from .services.classifier import get_classifier

        try:
            get_classifier()
        except Exception:  # noqa: BLE001 — o health check reportará o estado degradado
            logger.exception("Não foi possível pré-carregar o modelo")
