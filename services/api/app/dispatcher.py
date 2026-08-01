import hashlib
import secrets
from typing import Any, Literal

from app.config import Settings
from app.convex_gateway import ConvexGateway
from app.executor import ExecutorUnavailable, SandboxExecutor
from app.models import DispatchResult, WorkerBlocker, WorkerJob, WorkerResultEnvelope, WorkerUsage, canonical_sha256


class Dispatcher:
    def __init__(self, settings: Settings, gateway: ConvexGateway, executor: SandboxExecutor) -> None:
        self._settings = settings
        self._gateway = gateway
        self._executor = executor

    async def dispatch_once(self) -> DispatchResult:
        reconciliation = await self._gateway.requeue_expired_leases()
        await self._executor.cleanup(reconciliation.get("orphanSandboxIds", []))
        lease_token = secrets.token_urlsafe(32)
        lease_hash = hashlib.sha256(lease_token.encode()).hexdigest()
        step = await self._gateway.claim_next_step(
            self._settings.dispatcher_id,
            lease_hash,
            self._settings.workflow_lease_seconds * 1000,
        )
        if step is None:
            return DispatchResult(status="idle")

        job = WorkerJob(
            run_id=step.run_id,
            step_id=step.step_id,
            attempt=step.attempt,
            kind=step.kind,
            input=self._minimal_job_input(step.input),
            template_version=self._settings.e2b_template_version,
            worker_version=self._settings.e2b_worker_version,
        )
        sandbox_id: str | None = None

        async def mark_started(value: str) -> None:
            nonlocal sandbox_id
            sandbox_id = value
            await self._gateway.mark_running(step.step_id, lease_hash, value)

        try:
            sandbox_id, envelope = await self._executor.execute(job, lease_token, mark_started)
            self._validate_result(job, envelope)
        except ExecutorUnavailable as exc:
            envelope = self._blocked_envelope(job, "e2b_not_configured", str(exc), retryable=False)
        except Exception:
            envelope = self._blocked_envelope(
                job,
                "worker_execution_failed",
                "The isolated worker failed before producing a valid artifact.",
                retryable=True,
                status="failed",
            )

        if envelope.status == "failed" and envelope.blocker is not None and envelope.blocker.retryable:
            await self._gateway.fail_attempt(envelope, lease_hash)
        else:
            await self._gateway.complete_step(envelope, lease_hash)
        return DispatchResult(status=envelope.status, run_id=step.run_id, step_id=step.step_id, sandbox_id=sandbox_id)

    @staticmethod
    def _validate_result(job: WorkerJob, envelope: WorkerResultEnvelope) -> None:
        if (envelope.run_id, envelope.step_id, envelope.attempt) != (job.run_id, job.step_id, job.attempt):
            raise ValueError("Worker result does not match its lease")
        envelope.verify_artifact_digest()

    @staticmethod
    def _minimal_job_input(value: dict[str, Any]) -> dict[str, Any]:
        profile = value.get("profile")
        if not isinstance(profile, dict):
            raise ValueError("Workflow step is missing its validated profile")
        allowed = ("name", "stage", "sectors", "targetRegions", "region")
        return {"profile": {key: profile[key] for key in allowed if key in profile}}

    def _blocked_envelope(
        self,
        job: WorkerJob,
        code: str,
        message: str,
        *,
        retryable: bool,
        status: Literal["blocked", "failed"] = "blocked",
    ) -> WorkerResultEnvelope:
        artifact: dict[str, Any] = {}
        return WorkerResultEnvelope(
            run_id=job.run_id,
            step_id=job.step_id,
            attempt=job.attempt,
            template_version=job.template_version,
            worker_version=job.worker_version,
            status=status,
            output_type="research_plan",
            artifact_sha256=canonical_sha256(artifact),
            artifact=artifact,
            source_manifest=[],
            usage=WorkerUsage(duration_ms=0, provider_calls=0, input_bytes=0, output_bytes=2),
            blocker=WorkerBlocker(code=code, safe_message=message, retryable=retryable),
        )
