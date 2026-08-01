from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings
from app.main import create_app
from app.models import ClaimedStep
from tests.fakes import FakeExecutor, FakeGateway

PROFILE = {
    "name": "Kivu Grid",
    "organizationType": "startup",
    "website": "https://example.org",
    "location": "Kigali, Rwanda",
    "region": "Africa",
    "stage": "seed",
    "sectors": ["climate", "energy"],
    "raiseAmountUsd": 1_500_000,
    "oneLiner": "Distributed energy intelligence for commercial buildings.",
    "traction": "Twenty paid sites and twelve months of measured operating data.",
    "impact": "Lower energy cost and diesel use for growing businesses.",
    "founderContext": "The team has operated regional infrastructure for ten years.",
    "targetRegions": ["US", "UK", "EU"],
    "consentToProcess": True,
}


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "convex_url": "https://example.convex.cloud",
        "workflow_action_secret": SecretStr("workflow-secret"),
        "fastapi_service_token": SecretStr("service-token"),
        "oidc_issuer_url": "https://identity.example.com",
        "oidc_audience": "firstcontact-api",
        "execution_mode": "disabled",
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def headers() -> dict[str, str]:
    return {"Authorization": "Bearer service-token"}


def user_headers() -> dict[str, str]:
    return {"Authorization": "Bearer header.payload.signature"}


def test_health_is_truthful_about_disabled_execution() -> None:
    client = TestClient(create_app(settings(), FakeGateway(), FakeExecutor()))
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["capabilities"] == {"convex": True, "oidc": True, "e2b": False, "research": False}


def test_provider_gateway_fails_closed_without_exa_configuration() -> None:
    gateway = FakeGateway()
    client = TestClient(create_app(settings(), gateway, FakeExecutor()))
    response = client.post(
        "/internal/v1/providers/exa/search",
        headers={"x-worker-token": "scoped-lease-token"},
        json={
            "stepId": "step-1",
            "attempt": 1,
            "operationKey": "step-1/query/0001",
            "query": "seed climate investors with an official Africa mandate",
            "numResults": 10,
        },
    )
    assert response.status_code == 503
    assert gateway.provider_reservations == []


def test_private_routes_require_the_service_token() -> None:
    client = TestClient(create_app(settings(), FakeGateway(), FakeExecutor()))
    assert client.get("/v1/addons").status_code == 401
    assert client.get("/v1/addons", headers=headers()).status_code == 200


def test_create_run_derives_the_actor_from_authentication() -> None:
    gateway = FakeGateway()
    executor = FakeExecutor()
    client = TestClient(create_app(settings(), gateway, executor))
    response = client.post(
        "/v1/workflows/runs",
        headers=user_headers(),
        json={
            "campaignId": "campaign-1",
            "kind": "investor_research",
            "idempotencyKey": "campaign-1/research/0001",
            "budgetUsd": 5,
        },
    )
    assert response.status_code == 202
    assert response.json() == {"runId": "run-1", "duplicate": False}
    assert gateway.created[0][1] == "header.payload.signature"


def test_workflow_routes_reject_service_tokens_and_unconfigured_oidc() -> None:
    gateway = FakeGateway()
    client = TestClient(create_app(settings(), gateway, FakeExecutor()))
    response = client.post(
        "/v1/workflows/runs",
        headers=headers(),
        json={
            "campaignId": "campaign-1",
            "kind": "investor_research",
            "idempotencyKey": "campaign-1/research/0001",
            "budgetUsd": 5,
        },
    )
    assert response.status_code == 401
    assert gateway.created == []

    unconfigured = TestClient(create_app(settings(oidc_issuer_url="", oidc_audience=""), gateway, FakeExecutor()))
    response = unconfigured.post(
        "/v1/workflows/runs",
        headers=user_headers(),
        json={
            "campaignId": "campaign-1",
            "kind": "investor_research",
            "idempotencyKey": "campaign-1/research/0001",
            "budgetUsd": 5,
        },
    )
    assert response.status_code == 503


def test_dispatch_executes_a_leased_step_and_commits_the_artifact() -> None:
    gateway = FakeGateway(
        ClaimedStep(
            step_id="step-1",
            run_id="run-1",
            attempt=1,
            kind="investor_research",
            input={"profile": PROFILE},
            budget_usd=5,
            spent_usd=0,
        )
    )
    executor = FakeExecutor()
    client = TestClient(create_app(settings(), gateway, executor))
    response = client.post("/internal/v1/dispatcher/once", headers=headers())
    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
    assert gateway.running[0][2] == "sandbox-1"
    assert gateway.completed[0][0].artifact["schemaVersion"] == "research-plan-v1"
    assert gateway.reconciliations == 1
    assert "founderContext" not in executor.jobs[0].input["profile"]


def test_missing_e2b_configuration_becomes_a_visible_blocker() -> None:
    gateway = FakeGateway(
        ClaimedStep(
            step_id="step-1",
            run_id="run-1",
            attempt=1,
            kind="investor_research",
            input={"profile": PROFILE},
            budget_usd=5,
            spent_usd=0,
        )
    )
    client = TestClient(create_app(settings(), gateway))
    response = client.post("/internal/v1/dispatcher/once", headers=headers())
    assert response.status_code == 200
    assert response.json()["status"] == "blocked"
    assert gateway.completed[0][0].blocker is not None
    assert gateway.completed[0][0].blocker.code == "e2b_not_configured"


def test_transient_worker_failure_is_requeued_instead_of_committed_terminally() -> None:
    class FailingExecutor:
        async def cleanup(self, sandbox_ids):  # type: ignore[no-untyped-def]
            del sandbox_ids

        async def execute(self, job, worker_token, on_started):  # type: ignore[no-untyped-def]
            del job, worker_token, on_started
            raise RuntimeError("private provider detail")

    gateway = FakeGateway(
        ClaimedStep(
            step_id="step-1",
            run_id="run-1",
            attempt=1,
            kind="investor_research",
            input={"profile": PROFILE},
            budget_usd=5,
            spent_usd=0,
        )
    )
    client = TestClient(create_app(settings(), gateway, FailingExecutor()))
    response = client.post("/internal/v1/dispatcher/once", headers=headers())
    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert gateway.completed == []
    assert gateway.failed[0][0].blocker is not None
    assert gateway.failed[0][0].blocker.code == "worker_execution_failed"
    assert "private provider detail" not in gateway.failed[0][0].blocker.safe_message


def test_worker_callback_rejects_a_tampered_artifact() -> None:
    gateway = FakeGateway()
    client = TestClient(create_app(settings(), gateway, FakeExecutor()))
    response = client.post(
        "/internal/v1/worker/result",
        headers={"x-worker-token": "one-time-token"},
        json={
            "runId": "run-1",
            "stepId": "step-1",
            "attempt": 1,
            "templateVersion": "firstcontact-python-v1",
            "workerVersion": "0.1.0",
            "status": "succeeded",
            "outputType": "research_plan",
            "artifactSha256": "a" * 64,
            "artifact": {"changed": True},
            "sourceManifest": [],
            "usage": {"durationMs": 1, "providerCalls": 0, "inputBytes": 1, "outputBytes": 1},
        },
    )
    assert response.status_code == 400
    assert gateway.completed == []
