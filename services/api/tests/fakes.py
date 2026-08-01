from typing import Any

from app.models import ClaimedStep, WorkerJob, WorkerResultEnvelope, WorkflowRunRequest, canonical_sha256


class FakeGateway:
    def __init__(self, claimed: ClaimedStep | None = None) -> None:
        self.claimed = claimed
        self.created: list[tuple[WorkflowRunRequest, str]] = []
        self.completed: list[tuple[WorkerResultEnvelope, str]] = []
        self.running: list[tuple[str, str, str]] = []
        self.cancelled: list[tuple[str, str]] = []
        self.failed: list[tuple[WorkerResultEnvelope, str]] = []
        self.reconciliations = 0
        self.provider_reservations: list[tuple[str, str, str, str, float]] = []
        self.provider_finalizations: list[tuple[object, ...]] = []

    async def create_run(self, request: WorkflowRunRequest, access_token: str) -> dict[str, Any]:
        self.created.append((request, access_token))
        return {"runId": "run-1", "duplicate": False}

    async def get_run(self, run_id: str, access_token: str) -> dict[str, Any] | None:
        del access_token
        if run_id == "missing":
            return None
        return {"run": {"_id": run_id, "status": "queued"}, "steps": [], "artifacts": []}

    async def cancel_run(self, run_id: str, access_token: str) -> dict[str, Any]:
        self.cancelled.append((run_id, access_token))
        return {"sandboxIds": []}

    async def claim_next_step(self, lease_owner: str, lease_token_hash: str, lease_ms: int) -> ClaimedStep | None:
        del lease_owner, lease_token_hash, lease_ms
        value, self.claimed = self.claimed, None
        return value

    async def mark_running(self, step_id: str, lease_token_hash: str, sandbox_id: str) -> None:
        self.running.append((step_id, lease_token_hash, sandbox_id))

    async def complete_step(self, envelope: WorkerResultEnvelope, lease_token_hash: str) -> dict[str, Any]:
        self.completed.append((envelope, lease_token_hash))
        return {"duplicate": False, "artifactId": "artifact-1"}

    async def fail_attempt(self, envelope: WorkerResultEnvelope, lease_token_hash: str) -> dict[str, Any]:
        self.failed.append((envelope, lease_token_hash))
        return {"retrying": True, "nextAttempt": envelope.attempt + 1}

    async def requeue_expired_leases(self) -> dict[str, Any]:
        self.reconciliations += 1
        return {"requeued": 0, "failed": 0, "orphanSandboxIds": []}

    async def reserve_provider_operation(
        self, step_id: str, lease_token_hash: str, operation_key: str, request_digest: str, reserved_cost_usd: float
    ) -> dict[str, Any]:
        self.provider_reservations.append(
            (step_id, lease_token_hash, operation_key, request_digest, reserved_cost_usd)
        )
        return {"operationId": "provider-operation-1", "duplicate": False, "status": "reserved"}

    async def finalize_provider_operation(
        self, operation_id: str, lease_token_hash: str, status: str, actual_cost_usd: float,
        provider_request_id: str | None, response: dict[str, Any] | None, safe_error_code: str | None,
    ) -> dict[str, Any]:
        self.provider_finalizations.append(
            (operation_id, lease_token_hash, status, actual_cost_usd, provider_request_id, response, safe_error_code)
        )
        return {"duplicate": False}


class FakeExecutor:
    def __init__(self) -> None:
        self.jobs: list[WorkerJob] = []

    async def execute(self, job: WorkerJob, worker_token: str, on_started):  # type: ignore[no-untyped-def]
        del worker_token
        self.jobs.append(job)
        await on_started("sandbox-1")
        artifact = {"schemaVersion": "research-plan-v1", "queries": [], "notice": "No contacts were generated."}
        return "sandbox-1", WorkerResultEnvelope.model_validate(
            {
                "runId": job.run_id,
                "stepId": job.step_id,
                "attempt": job.attempt,
                "templateVersion": job.template_version,
                "workerVersion": job.worker_version,
                "status": "succeeded",
                "outputType": "research_plan",
                "artifactSha256": canonical_sha256(artifact),
                "artifact": artifact,
                "sourceManifest": [],
                "usage": {"durationMs": 5, "providerCalls": 0, "inputBytes": 10, "outputBytes": 10},
            }
        )

    async def cleanup(self, sandbox_ids: list[str]) -> None:
        del sandbox_ids
