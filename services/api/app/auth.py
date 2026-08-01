import secrets
from collections.abc import Callable

from fastapi import Header, HTTPException, status

from app.config import Settings


def oidc_bearer_dependency(settings: Settings) -> Callable[..., str]:
    def require_oidc_bearer(authorization: str | None = Header(default=None)) -> str:
        if not settings.oidc_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Organization authentication is not configured",
            )
        supplied = (
            authorization.removeprefix("Bearer ")
            if authorization and authorization.startswith("Bearer ")
            else ""
        )
        # Convex performs cryptographic OIDC verification using auth.config.ts.
        # FastAPI never derives identity from these unverified claims.
        if supplied.count(".") != 2:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
        return supplied

    return require_oidc_bearer


def service_token_dependency(settings: Settings) -> Callable[..., str]:
    def require_service_token(authorization: str | None = Header(default=None)) -> str:
        expected = settings.fastapi_service_token.get_secret_value()
        supplied = (
            authorization.removeprefix("Bearer ") if authorization and authorization.startswith("Bearer ") else ""
        )
        if not expected or not supplied or not secrets.compare_digest(expected, supplied):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
        return "fastapi-service"

    return require_service_token
