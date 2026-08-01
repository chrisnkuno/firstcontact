import hashlib
import json
import os
import sys
import time
from typing import Any
from urllib.request import Request, urlopen


def canonical_bytes(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def build_research_plan(job: dict[str, Any]) -> dict[str, Any]:
    profile = job["input"]["profile"]
    sectors = [str(value).strip() for value in profile["sectors"]][:5]
    target_regions = [str(value) for value in profile["targetRegions"]][:4]
    stage = str(profile["stage"])
    organization = str(profile["name"])
    queries = [
        {
            "purpose": "official_fund_mandates",
            "query": f"{stage} investors in {', '.join(sectors)} with published mandates for {profile['region']}",
            "preferredSources": [
                "official fund sites",
                "official portfolio pages",
                "regulator or institutional records",
            ],
        },
        {
            "purpose": "capital_region_fit",
            "query": (
                f"{', '.join(target_regions)} funds investing in {profile['region']} {', '.join(sectors)} companies"
            ),
            "preferredSources": ["official thesis pages", "official fund or vehicle pages"],
        },
    ]
    return {
        "schemaVersion": "research-plan-v1",
        "organization": organization,
        "stage": stage,
        "sectors": sectors,
        "targetRegions": target_regions,
        "queries": queries,
        "hardGates": [
            "source freshness",
            "stage",
            "sector",
            "geography",
            "capital type",
            "jurisdiction",
            "suppression",
        ],
        "notice": "This artifact is a research plan, not a verified investor list or authorization to contact anyone.",
    }


def execute_research(job: dict[str, Any], plan: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], int]:
    gateway = os.environ.get("FIRSTCONTACT_GATEWAY_URL", "").rstrip("/")
    worker_token = os.environ.get("FIRSTCONTACT_WORKER_TOKEN", "")
    if not gateway or not worker_token:
        return plan, [], 0

    collected: dict[str, dict[str, Any]] = {}
    request_ids: list[str] = []
    provider_cost_usd = 0.0
    provider_calls = 0
    for item in plan["queries"]:
        query = str(item["query"])
        query_digest = hashlib.sha256(query.encode()).hexdigest()
        payload = json.dumps({
            "stepId": job["stepId"],
            "attempt": job["attempt"],
            "operationKey": f"{job['stepId']}/{job['attempt']}/{query_digest[:32]}",
            "query": query,
            "numResults": 10,
        }, separators=(",", ":")).encode()
        request = Request(
            f"{gateway}/internal/v1/providers/exa/search",
            data=payload,
            headers={"content-type": "application/json", "x-worker-token": worker_token},
            method="POST",
        )
        with urlopen(request, timeout=45) as response:  # noqa: S310 - gateway URL is operator-configured and allowlisted
            result = json.loads(response.read(MAX_GATEWAY_RESPONSE_BYTES))
        provider_calls += 1
        if result.get("requestId"):
            request_ids.append(str(result["requestId"]))
        provider_cost_usd += float(result.get("costDollars", {}).get("total", 0))
        for source in result.get("results", []):
            if isinstance(source, dict) and isinstance(source.get("url"), str):
                collected[source["url"]] = source

    captured_at = int(time.time() * 1000)
    sources = list(collected.values())[:100]
    manifest = [{
        "url": source["url"],
        "capturedAt": captured_at,
        "contentSha256": hashlib.sha256(canonical_bytes(source)).hexdigest(),
    } for source in sources]
    artifact = {
        "schemaVersion": "discovery-v1",
        "researchPlan": plan,
        "sources": sources,
        "providerRequestIds": request_ids,
        "providerCostUsd": round(provider_cost_usd, 6),
        "notice": "These are source records for review, not verified contacts or authorization to send.",
    }
    return artifact, manifest, provider_calls


MAX_GATEWAY_RESPONSE_BYTES = 1_000_001


def main() -> None:
    started = time.monotonic()
    input_path = sys.argv[1]
    raw = open(input_path, "rb").read()  # noqa: SIM115 - short-lived sandbox process
    job = json.loads(raw)
    plan = build_research_plan(job)
    artifact, source_manifest, provider_calls = execute_research(job, plan)
    artifact_bytes = canonical_bytes(artifact)
    result = {
        "runId": job["runId"],
        "stepId": job["stepId"],
        "attempt": job["attempt"],
        "templateVersion": job["templateVersion"],
        "workerVersion": job["workerVersion"],
        "status": "succeeded",
        "outputType": "discovery" if provider_calls else "research_plan",
        "artifactSha256": hashlib.sha256(artifact_bytes).hexdigest(),
        "artifact": artifact,
        "sourceManifest": source_manifest,
        "usage": {
            "durationMs": int((time.monotonic() - started) * 1000),
            "providerCalls": provider_calls,
            "inputBytes": len(raw),
            "outputBytes": len(artifact_bytes),
        },
    }
    print(json.dumps(result, sort_keys=True, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
