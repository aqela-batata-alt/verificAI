from django.contrib import admin

from .models import Analysis


@admin.register(Analysis)
class AnalysisAdmin(admin.ModelAdmin):
    list_display = ("created_at", "status", "risk_index", "model_label", "model_confidence",
                    "model_version", "rules_version", "duration_ms")
    list_filter = ("status", "model_label", "model_version", "rules_version", "input_type")
    search_fields = ("id", "claim_summary")
    readonly_fields = [f.name for f in Analysis._meta.fields]

    def has_add_permission(self, request):
        return False
