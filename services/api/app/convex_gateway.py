from typing import Any, Protocol, cast

import httpx

from app.config import Settings
from app.models import ClaimedStep, WorkerResultEnvelope, WorkflowRunRequest


class ConvexGatewayError(RuntimeError):
    pass


class ConvexGateway(Protocol):
    async def create_run(self, request: WorkflowRunRequest, access_token: str) -> dict[str, Any]: ...

    async def get_run(self, run_id: str, access_token: str) -> dict[str, Any] | None: ...

    async def cancel_run(self, run_id: str, access_token: str) -> dict[str, Any]: ...

    async def claim_next_step(self, lease_owner: str, lease_token_hash: str, lease_ms: int) -> ClaimedStep | None: ...

    async def mark_running(self, step_id: str, lease_token_hash: str, sandbox_id: str) -> None: ...

    async def complete_step(self, envelope: WorkerResultEnvelope, lease_token_hash: str) -> dict[str, Any]: ...

    async def fail_attempt(self, envelope: WorkerResultEnvelope, lease_token_hash: str) -> dict[str, Any]: ...

    async def requeue_expired_leases(self) -> dict[str, Any]: ...

    async def reserve_provider_operation(
        self, step_id: str, lease_token_hash: str, operation_key: str, request_digest: str, reserved_cost_usd: float
    ) -> dict[str, Any]: ...

    async def finalize_provider_operation(
        self, operation_id: str, lease_token_hash: str, status: str, actual_cost_usd: float,
        provider_request_id: str | None, response: dict[str, Any] | None, safe_error_code: str | None,
    ) -> dict[str, Any]: ...


class HttpConvexGateway:
    def __init__(self, settings: Settings) -> None:
        self._url = settings.convex_url.rstrip("/")
        self._secret = settings.workflow_action_secret.get_secret_value()

    async def _call(self, function_type: str, path: str, args: dict[str, Any], access_token: str | None = None) -> Any:
        if not self._url or not self._secret:
            raise ConvexGatewayError("Convex workflow persistence is not configured")
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"Bearer {access_token}"} if access_token else None
            response = await client.post(
                f"{self._url}/api/{function_type}",
                json={"path": path, "args": args, "format": "json"},
                headers=headers,
            )
        if response.status_code != 200:
            raise ConvexGatewayError(f"Convex returned HTTP {response.status_code}")
        payload = response.json()
        if payload.get("status") != "success":
            raise ConvexGatewayError(payload.get("errorMessage", "Convex workflow call failed"))
        return payload.get("value")

    async def create_run(self, request: WorkflowRunRequest, access_token: str) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            await self._call(
                "mutation",
                "workflows:createRun",
                {
                    "campaignId": request.campaign_id,
                    "kind": request.kind,
                    "idempotencyKey": request.idempotency_key,
                    "budgetUsd": request.budget_usd,
                },
                access_token,
            ),
        )

    async def get_run(self, run_id: str, access_token: str) -> dict[str, Any] | None:
        return cast(
            dict[str, Any] | None,
            await self._call("query", "workflows:getRun", {"runId": run_id}, access_token),
        )

    async def cancel_run(self, run_id: str, access_token: str) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            await self._call("mutation", "workflows:cancelRun", {"runId": run_id, "now": now_ms()}, access_token),
        )

    async def claim_next_step(self, lease_owner: str, lease_token_hash: str, lease_ms: int) -> ClaimedStep | None:
        value = await self._call(
            "mutation",
            "workflows:claimNextStep",
            {
                "workflowSecret": self._secret,
                "leaseOwner": lease_owner,
                "leaseTokenHash": lease_token_hash,
                "leaseMs": lease_ms,
                "now": now_ms(),
            },
        )
        return ClaimedStep.model_validate(value) if value else None

    async def mark_running(self, step_id: str, lease_token_hash: str, sandbox_id: str) -> None:
        await self._call(
            "mutation",
            "workflows:markRunning",
            {
                "workflowSecret": self._secret,
                "stepId": step_id,
                "leaseTokenHash": lease_token_hash,
                "sandboxId": sandbox_id,
                "now": now_ms(),
            },
        )

    async def complete_step(self, envelope: WorkerResultEnvelope, lease_token_hash: str) -> dict[str, Any]:
        values = envelope.model_dump(mode="json", by_alias=True)
        values.pop("runId")
        return cast(
            dict[str, Any],
            await self._call(
                "mutation",
                "workflows:completeStep",
                {"workflowSecret": self._secret, "leaseTokenHash": lease_token_hash, "now": now_ms(), **values},
            ),
        )

    async def fail_attempt(self, envelope: WorkerResultEnvelope, lease_token_hash: str) -> dict[str, Any]:
        if envelope.blocker is None:
            raise ConvexGatewayError("A retryable failure requires a blocker")
        retry_delay_ms = min(15 * 60_000, 5_000 * (2 ** (envelope.attempt - 1)))
        return cast(
            dict[str, Any],
            await self._call(
                "mutation",
                "workflows:failAttempt",
                {
                    "workflowSecret": self._secret,
                    "stepId": envelope.step_id,
                    "leaseTokenHash": lease_token_hash,
                    "attempt": envelope.attempt,
                    "code": envelope.blocker.code,
                    "safeMessage": envelope.blocker.safe_message,
                    "retryDelayMs": retry_delay_ms,
                    "now": now_ms(),
                },
            ),
        )

    async def requeue_expired_leases(self) -> dict[str, Any]:
        return cast(
            dict[str, Any],
            await self._call(
                "mutation",
                "workflows:requeueExpiredLeases",
                {"workflowSecret": self._secret, "now": now_ms()},
            ),
        )

    async def reserve_provider_operation(
        self, step_id: str, lease_token_hash: str, operation_key: str, request_digest: str, reserved_cost_usd: float
    ) -> dict[str, Any]:
        return cast(dict[str, Any], await self._call("mutation", "workflows:reserveProviderOperation", {
            "workflowSecret": self._secret, "stepId": step_id, "leaseTokenHash": lease_token_hash,
            "operationKey": operation_key, "requestDigest": request_digest,
            "reservedCostUsd": reserved_cost_usd, "now": now_ms(),
        }))

    async def finalize_provider_operation(
        self, operation_id: str, lease_token_hash: str, status: str, actual_cost_usd: float,
        provider_request_id: str | None, response: dict[str, Any] | None, safe_error_code: str | None,
    ) -> dict[str, Any]:
        return cast(dict[str, Any], await self._call("mutation", "workflows:finalizeProviderOperation", {
            "workflowSecret": self._secret, "operationId": operation_id, "leaseTokenHash": lease_token_hash,
            "status": status, "actualCostUsd": actual_cost_usd, "providerRequestId": provider_request_id,
            "response": response, "safeErrorCode": safe_error_code, "now": now_ms(),
        }))


def now_ms() -> int:
    import time

    return int(time.time() * 1000)
