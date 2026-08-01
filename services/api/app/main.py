import hashlib
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Response, status

from app.addons import ADDONS
from app.auth import oidc_bearer_dependency, service_token_dependency
from app.config import Settings, get_settings
from app.convex_gateway import ConvexGateway, ConvexGatewayError, HttpConvexGateway
from app.dispatcher import Dispatcher
from app.executor import DisabledExecutor, E2BExecutor, SandboxExecutor
from app.models import DispatchResult, ExaSearchRequest, WorkerResultEnvelope, WorkflowRunRequest
from app.providers import ProviderGatewayError, execute_exa_search


def create_app(
    settings: Settings | None = None,
    gateway: ConvexGateway | None = None,
    executor: SandboxExecutor | None = None,
) -> FastAPI:
    resolved = settings or get_settings()
    convex = gateway or HttpConvexGateway(resolved)
    sandbox_executor = executor or (E2BExecutor(resolved) if resolved.execution_mode == "e2b" else DisabledExecutor())
    dispatcher = Dispatcher(resolved, convex, sandbox_executor)
    require_service_token = service_token_dependency(resolved)
    require_oidc_bearer = oidc_bearer_dependency(resolved)
    app = FastAPI(
        title="FirstContact API",
        version="0.1.0",
        docs_url="/docs" if resolved.environment != "production" else None,
    )

    def principal(_: str = Depends(require_service_token)) -> str:
        return "fastapi-service"

    @app.get("/healthz")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "service": "firstcontact-api",
            "environment": resolved.environment,
            "executionMode": resolved.execution_mode,
            "capabilities": {
                "convex": resolved.convex_configured,
                "oidc": resolved.oidc_configured,
                "e2b": resolved.e2b_configured,
                "research": resolved.research_configured,
            },
        }

    @app.get("/readyz")
    async def ready(response: Response) -> dict[str, Any]:
        ready_now = resolved.convex_configured and (resolved.execution_mode == "disabled" or resolved.e2b_configured)
        if not ready_now:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "ready": ready_now,
            "convex": resolved.convex_configured,
            "oidc": resolved.oidc_configured,
            "e2b": resolved.e2b_configured,
            "research": resolved.research_configured,
        }

    @app.get("/v1/addons")
    async def list_addons(_: str = Depends(principal)) -> list[dict[str, Any]]:
        return [manifest.model_dump(mode="json", by_alias=True) for manifest in ADDONS.values()]

    @app.post("/v1/workflows/runs", status_code=status.HTTP_202_ACCEPTED)
    async def create_run(
        request: WorkflowRunRequest,
        access_token: str = Depends(require_oidc_bearer),
    ) -> dict[str, Any]:
        try:
            return await convex.create_run(request, access_token)
        except ConvexGatewayError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    @app.get("/v1/workflows/runs/{run_id}")
    async def get_run(run_id: str, access_token: str = Depends(require_oidc_bearer)) -> dict[str, Any]:
        try:
            value = await convex.get_run(run_id, access_token)
        except ConvexGatewayError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
        if value is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow run not found")
        return value

    @app.post("/v1/workflows/runs/{run_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
    async def cancel_run(run_id: str, access_token: str = Depends(require_oidc_bearer)) -> Response:
        result = await convex.cancel_run(run_id, access_token)
        await sandbox_executor.cleanup(result.get("sandboxIds", []))
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.post("/internal/v1/dispatcher/once")
    async def dispatch_once(_: str = Depends(principal)) -> DispatchResult:
        return await dispatcher.dispatch_once()

    @app.post("/internal/v1/worker/result")
    async def ingest_worker_result(envelope: WorkerResultEnvelope, x_worker_token: str = Header()) -> dict[str, Any]:
        try:
            envelope.verify_artifact_digest()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        lease_hash = hashlib.sha256(x_worker_token.encode()).hexdigest()
        if envelope.status == "failed" and envelope.blocker is not None and envelope.blocker.retryable:
            return await convex.fail_attempt(envelope, lease_hash)
        return await convex.complete_step(envelope, lease_hash)

    @app.post("/internal/v1/providers/exa/search")
    async def exa_search(request: ExaSearchRequest, x_worker_token: str = Header()) -> dict[str, Any]:
        try:
            return await execute_exa_search(resolved, convex, request, x_worker_token)
        except ProviderGatewayError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return app


app = create_app()
