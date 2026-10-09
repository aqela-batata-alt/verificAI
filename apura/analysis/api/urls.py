from django.urls import path

from .views import AnalysisCreateView, AnalysisDetailView, HealthView

app_name = "api-v1"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("analyses/", AnalysisCreateView.as_view(), name="analysis-create"),
    path("analyses/<uuid:analysis_id>/", AnalysisDetailView.as_view(), name="analysis-detail"),
]
