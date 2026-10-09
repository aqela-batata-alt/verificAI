"""
Persistência de análises.

Por padrão NÃO armazenamos o texto bruto enviado (RF05). Guardamos apenas o
resumo mascarado da alegação, o resultado e as versões de todos os componentes
usados (RF21), permitindo reconstruir a configuração da análise.
"""

import uuid

from django.conf import settings
from django.db import models


class Analysis(models.Model):
    class InputType(models.TextChoices):
        TEXT = "text", "Texto"
        URL = "url", "URL"

    class Status(models.TextChoices):
        LOW = "poucos_sinais_de_risco", "Poucos sinais de risco"
        ATTENTION = "requer_atencao", "Requer atenção"
        HIGH = "alto_risco", "Alto risco"
        INCONCLUSIVE = "analise_inconclusiva", "Análise inconclusiva"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # Vínculo opcional (Etapa 4: contas e limite de visitante)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="analyses"
    )
    visitor_id = models.CharField(max_length=64, blank=True, db_index=True)

    input_type = models.CharField(max_length=8, choices=InputType.choices)
    source_domain = models.CharField(max_length=255, blank=True)
    claim_summary = models.CharField(max_length=255, help_text="Resumo com dados pessoais mascarados.")

    status = models.CharField(max_length=32, choices=Status.choices)
    risk_index = models.FloatField(null=True, blank=True)
    abstention_reasons = models.JSONField(default=list, blank=True)

    model_label = models.CharField(max_length=16)
    model_fake_probability = models.FloatField()
    model_confidence = models.FloatField()

    # Detalhes técnicos: sinais, pesos, fatiamento, indicadores (sem texto bruto)
    technical = models.JSONField(default=dict)

    # Versionamento (RF21)
    model_version = models.CharField(max_length=64)
    model_sha256 = models.CharField(max_length=128)
    rules_version = models.CharField(max_length=32)
    calibrator_version = models.CharField(max_length=32)
    schema_version = models.CharField(max_length=16)
    code_version = models.CharField(max_length=64, blank=True)

    duration_ms = models.FloatField()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "análise"
        verbose_name_plural = "análises"

    def __str__(self) -> str:
        return f"{self.get_status_display()} — {self.claim_summary[:60]}"
