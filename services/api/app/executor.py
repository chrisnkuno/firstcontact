import asyncio
import json
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse

from app.config import Settings
from app.models import WorkerJob, WorkerResultEnvelope

StartedCallback = Callable[[str], Coroutine[Any, Any, None]]


class ExecutorUnavailable(RuntimeError):
    pass


class SandboxExecutor(Protocol):
    async def execute(
        self, job: WorkerJob, worker_token: str, on_started: StartedCallback
    ) -> tuple[str, WorkerResultEnvelope]: ...

    async def cleanup(self, sandbox_ids: list[str]) -> None: ...


class DisabledExecutor:
    async def execute(
        self, job: WorkerJob, worker_token: str, on_started: StartedCallback
    ) -> tuple[str, WorkerResultEnvelope]:
        del job, worker_token, on_started
        raise ExecutorUnavailable("E2B execution is disabled in this environment")

    async def cleanup(self, sandbox_ids: list[str]) -> None:
        del sandbox_ids


class E2BExecutor:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._worker_path = Path(__file__).parent / "e2b_runtime" / "worker.py"

    async def execute(
        self, job: WorkerJob, worker_token: str, on_started: StartedCallback
    ) -> tuple[str, WorkerResultEnvelope]:
        if not self._settings.e2b_configured:
            raise ExecutorUnavailable("E2B execution is not configured")
        return await asyncio.to_thread(self._execute_sync, job, worker_token, on_started)

    def _execute_sync(
        self, job: WorkerJob, worker_token: str, on_started: StartedCallback
    ) -> tuple[str, WorkerResultEnvelope]:
        from e2b import Sandbox  # type: ignore[import-untyped]

        gateway = urlparse(self._settings.worker_gateway_url)
        gateway_enabled = bool(gateway.scheme in {"http", "https"} and gateway.hostname)
        if self._settings.environment in {"staging", "production"} and gateway_enabled and gateway.scheme != "https":
            raise RuntimeError("The worker gateway must use HTTPS outside development")
        sandbox = Sandbox.create(
            template=self._settings.e2b_template,
            timeout=self._settings.e2b_timeout_seconds,
            secure=True,
            envs={
                "FIRSTCONTACT_WORKER_TOKEN": worker_token,
                "FIRSTCONTACT_GATEWAY_URL": self._settings.worker_gateway_url,
            }
            if gateway_enabled
            else None,
            allow_internet_access=gateway_enabled,
            network={"allow_out": [gateway.hostname], "allow_public_traffic": False} if gateway_enabled else None,
            api_key=self._settings.e2b_api_key.get_secret_value(),
            metadata={"run_id": job.run_id, "step_id": job.step_id, "environment": self._settings.environment},
        )
        sandbox_id = sandbox.sandbox_id
        asyncio.run(on_started(sandbox_id))
        try:
            sandbox.files.write("/tmp/firstcontact_worker.py", self._worker_path.read_text(encoding="utf-8"))
            sandbox.files.write("/tmp/firstcontact_job.json", job.model_dump_json(by_alias=True))
            result = sandbox.commands.run("python /tmp/firstcontact_worker.py /tmp/firstcontact_job.json")
            if result.exit_code != 0:
                raise RuntimeError("Sandbox worker exited unsuccessfully")
            output = result.stdout.strip().splitlines()
            if not output:
                raise RuntimeError("Sandbox worker returned no result")
            envelope = WorkerResultEnvelope.model_validate(json.loads(output[-1]))
            return sandbox_id, envelope
        finally:
            sandbox.kill()

    async def cleanup(self, sandbox_ids: list[str]) -> None:
        if not sandbox_ids or not self._settings.e2b_configured:
            return
        await asyncio.to_thread(self._cleanup_sync, sandbox_ids)

    def _cleanup_sync(self, sandbox_ids: list[str]) -> None:
        from e2b import Sandbox

        for sandbox_id in sandbox_ids[:100]:
            try:
                Sandbox.connect(sandbox_id, api_key=self._settings.e2b_api_key.get_secret_value()).kill()
            except Exception:
                continue
