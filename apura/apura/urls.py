"""Rotas principais do projeto Apura / Fake Eyes."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("analysis.api.urls", namespace="api-v1")),
]
