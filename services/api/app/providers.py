import hashlib
import json
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import Settings
from app.convex_gateway import ConvexGateway
from app.models import ExaSearchRequest

RESERVED_EXA_SEARCH_COST_USD = 1.0
MAX_PROVIDER_RESPONSE_BYTES = 1_000_000


class ProviderGatewayError(RuntimeError):
    pass


def _request_digest(request: ExaSearchRequest) -> str:
    value = {"query": request.query, "numResults": request.num_results, "category": "company", "moderation": True}
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _safe_url(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 2048:
        return None
    parsed = urlparse(value)
    return value if parsed.scheme in {"http", "https"} and parsed.netloc else None


def _bounded_text(value: object, limit: int) -> str | None:
    return value[:limit] if isinstance(value, str) else None


def _sanitize_exa_response(payload: dict[str, Any]) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for raw in payload.get("results", [])[:20] if isinstance(payload.get("results"), list) else []:
        if not isinstance(raw, dict):
            continue
        url = _safe_url(raw.get("url"))
        if not url:
            continue
        raw_highlights = raw.get("highlights")
        highlights: list[Any] = raw_highlights if isinstance(raw_highlights, list) else []
        results.append({
            "url": url,
            "title": _bounded_text(raw.get("title"), 500),
            "author": _bounded_text(raw.get("author"), 300),
            "publishedDate": _bounded_text(raw.get("publishedDate"), 100),
            "highlights": [_bounded_text(value, 2_000) for value in highlights[:5] if isinstance(value, str)],
        })
    raw_cost = payload.get("costDollars")
    cost: dict[str, Any] = raw_cost if isinstance(raw_cost, dict) else {}
    total = cost.get("total")
    return {
        "requestId": _bounded_text(payload.get("requestId"), 200),
        "costDollars": {"total": float(total) if isinstance(total, int | float) and total >= 0 else 0.0},
        "results": results,
    }


async def execute_exa_search(
    settings: Settings,
    gateway: ConvexGateway,
    request: ExaSearchRequest,
    worker_token: str,
) -> dict[str, Any]:
    if not settings.exa_api_key.get_secret_value():
        raise ProviderGatewayError("Research provider is not configured")
    lease_hash = hashlib.sha256(worker_token.encode()).hexdigest()
    reservation = await gateway.reserve_provider_operation(
        request.step_id,
        lease_hash,
        request.operation_key,
        _request_digest(request),
        RESERVED_EXA_SEARCH_COST_USD,
    )
    if reservation.get("duplicate"):
        response = reservation.get("response")
        if reservation.get("status") == "succeeded" and isinstance(response, dict):
            return response
        raise ProviderGatewayError("Provider operation is already in progress or failed")

    operation_id = str(reservation["operationId"])
    try:
        async with httpx.AsyncClient(timeout=settings.exa_timeout_seconds) as client:
            provider_response = await client.post(
                "https://api.exa.ai/search",
                headers={"x-api-key": settings.exa_api_key.get_secret_value(), "content-type": "application/json"},
                json={
                    "query": request.query,
                    "type": "auto",
                    "category": "company",
                    "numResults": request.num_results,
                    "contents": {"highlights": {"maxCharacters": 1600}},
                    "moderation": True,
                },
            )
        provider_response.raise_for_status()
        raw = provider_response.json()
        if not isinstance(raw, dict):
            raise ProviderGatewayError("Research provider returned an invalid response")
        response = _sanitize_exa_response(raw)
        if len(json.dumps(response, separators=(",", ":")).encode()) > MAX_PROVIDER_RESPONSE_BYTES:
            raise ProviderGatewayError("Research provider response exceeded the size limit")
        actual_cost = float(response["costDollars"]["total"])
        if actual_cost > RESERVED_EXA_SEARCH_COST_USD:
            raise ProviderGatewayError("Research provider cost exceeded its reservation")
        await gateway.finalize_provider_operation(
            operation_id, lease_hash, "succeeded", actual_cost, response.get("requestId"), response, None
        )
        return response
    except Exception as exc:
        await gateway.finalize_provider_operation(
            operation_id, lease_hash, "failed", 0, None, None, "exa_search_failed"
        )
        if isinstance(exc, ProviderGatewayError):
            raise
        raise ProviderGatewayError("Research provider request failed") from exc
