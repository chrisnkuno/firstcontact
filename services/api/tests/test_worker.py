import hashlib
import json

from app.e2b_runtime.worker import build_research_plan, canonical_bytes, execute_research


def test_research_plan_is_bounded_and_does_not_invent_contacts() -> None:
    job = {
        "input": {
            "profile": {
                "name": "Kivu Grid",
                "stage": "seed",
                "sectors": ["climate", "energy"],
                "targetRegions": ["US", "UK", "EU"],
                "region": "Africa",
            }
        }
    }
    artifact = build_research_plan(job)
    encoded = canonical_bytes(artifact)
    assert artifact["schemaVersion"] == "research-plan-v1"
    assert len(artifact["queries"]) == 2
    assert "email" not in json.dumps(artifact).lower()
    assert len(hashlib.sha256(encoded).hexdigest()) == 64


def test_scoped_gateway_results_become_source_evidence(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    job = {
        "stepId": "step-1",
        "attempt": 1,
        "input": {
            "profile": {
                "name": "Kivu Grid",
                "stage": "seed",
                "sectors": ["climate"],
                "targetRegions": ["US"],
                "region": "Africa",
            }
        },
    }
    plan = build_research_plan(job)

    class Response:
        def __enter__(self):  # type: ignore[no-untyped-def]
            return self

        def __exit__(self, *args):  # type: ignore[no-untyped-def]
            del args

        def read(self, limit: int) -> bytes:
            del limit
            return json.dumps({
                "requestId": "exa-request-1",
                "costDollars": {"total": 0.01},
                "results": [{
                    "url": "https://fund.example/thesis",
                    "title": "Example Fund",
                    "highlights": ["Published Africa climate thesis."],
                }],
            }).encode()

    monkeypatch.setenv("FIRSTCONTACT_GATEWAY_URL", "https://api.example")
    monkeypatch.setenv("FIRSTCONTACT_WORKER_TOKEN", "lease-token")
    monkeypatch.setattr("app.e2b_runtime.worker.urlopen", lambda request, timeout: Response())
    artifact, manifest, provider_calls = execute_research(job, plan)
    assert artifact["schemaVersion"] == "discovery-v1"
    assert artifact["sources"][0]["url"] == "https://fund.example/thesis"
    assert provider_calls == 2
    assert len(manifest[0]["contentSha256"]) == 64
    assert "email" not in json.dumps(artifact).lower()
