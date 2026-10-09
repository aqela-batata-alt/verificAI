"""
Estrutura de erro documentada da API (RF27, RF29):

    {
      "error": {
        "code": "text_too_short",          # código estável para a interface
        "message": "Descrição legível",
        "action": "O que o usuário pode fazer",
        "field": "text" | null,
        "details": {...}                   # opcional
      }
    }
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

DEFAULT_ACTIONS = {
    status.HTTP_400_BAD_REQUEST: "Corrija os dados enviados e tente novamente.",
    status.HTTP_404_NOT_FOUND: "Verifique o identificador informado.",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Utilize o método HTTP documentado.",
    status.HTTP_429_TOO_MANY_REQUESTS: "Aguarde alguns instantes antes de tentar novamente.",
}


def error_response(code: str, message: str, action: str, http_status: int,
                   field: str | None = None, details: dict | None = None) -> Response:
    body = {"error": {"code": code, "message": message, "action": action, "field": field}}
    if details:
        body["error"]["details"] = details
    return Response(body, status=http_status)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError) and isinstance(exc.detail, dict):
        field, messages = next(iter(exc.detail.items()), (None, ["Dados inválidos."]))
        message = messages[0] if isinstance(messages, list) and messages else str(messages)
        response.data = {"error": {
            "code": "validation_error",
            "message": str(message),
            "action": DEFAULT_ACTIONS[status.HTTP_400_BAD_REQUEST],
            "field": None if field == "non_field_errors" else field,
            "details": exc.detail,
        }}
        return response

    code = getattr(exc, "default_code", "error")
    if isinstance(exc, APIException) and hasattr(exc, "get_codes"):
        codes = exc.get_codes()
        code = codes if isinstance(codes, str) else code
    detail = getattr(exc, "detail", str(exc))
    response.data = {"error": {
        "code": str(code),
        "message": str(detail),
        "action": DEFAULT_ACTIONS.get(response.status_code, "Tente novamente mais tarde."),
        "field": None,
    }}
    return response
