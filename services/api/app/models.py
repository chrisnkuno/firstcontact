import hashlib
import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.title() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class StartupProfile(ApiModel):
    name: str = Field(min_length=2, max_length=100)
    organization_type: Literal["startup", "institution"]
    website: HttpUrl
    location: str = Field(min_length=2, max_length=120)
    region: Literal["Africa", "Latin America", "MENA", "South Asia", "Southeast Asia", "Other"]
    stage: Literal["pre-seed", "seed", "series-a", "series-b+", "growth", "institutional"]
    sectors: list[str] = Field(min_length=1, max_length=5)
    raise_amount_usd: int = Field(gt=0, le=1_000_000_000)
    one_liner: str = Field(min_length=20, max_length=240)
    traction: str = Field(min_length=20, max_length=1200)
    impact: str = Field(min_length=20, max_length=1200)
    founder_context: str = Field(min_length=20, max_length=1600)
    target_regions: list[Literal["US", "UK", "EU", "APAC"]] = Field(min_length=1, max_length=4)
    consent_to_process: Literal[True]


class WorkflowRunRequest(ApiModel):
    campaign_id: str = Field(min_length=1, max_length=100)
    kind: Literal["investor_research"]
    idempotency_key: str = Field(min_length=16, max_length=256)
    budget_usd: float = Field(gt=0, le=500)


class SourceManifestItem(ApiModel):
    url: HttpUrl
    captured_at: int = Field(ge=0)
    content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class WorkerUsage(ApiModel):
    duration_ms: int = Field(ge=0)
    provider_calls: int = Field(ge=0, le=1000)
    input_bytes: int = Field(ge=0, le=20_000_000)
    output_bytes: int = Field(ge=0, le=20_000_000)


class WorkerBlocker(ApiModel):
    code: str = Field(min_length=1, max_length=100)
    safe_message: str = Field(min_length=1, max_length=500)
    retryable: bool


class DiscoverySource(ApiModel):
    url: HttpUrl
    title: str | None = Field(default=None, max_length=500)
    author: str | None = Field(default=None, max_length=300)
    published_date: str | None = Field(default=None, max_length=100)
    highlights: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def bound_highlights(self) -> "DiscoverySource":
        if any(len(value) > 2_000 for value in self.highlights):
            raise ValueError("Discovery highlights exceed the size limit")
        return self


class DiscoveryArtifact(ApiModel):
    schema_version: Literal["discovery-v1"]
    research_plan: dict[str, Any]
    sources: list[DiscoverySource] = Field(max_length=100)
    provider_request_ids: list[str] = Field(max_length=10)
    provider_cost_usd: float = Field(ge=0, le=500)
    notice: str = Field(min_length=1, max_length=500)


class WorkerResultEnvelope(ApiModel):
    run_id: str = Field(min_length=1, max_length=100)
    step_id: str = Field(min_length=1, max_length=100)
    attempt: int = Field(gt=0, le=10)
    template_version: str = Field(min_length=1, max_length=100)
    worker_version: str = Field(min_length=1, max_length=100)
    status: Literal["succeeded", "blocked", "failed"]
    output_type: Literal["research_plan", "discovery", "evidence", "normalization", "matching", "draft"]
    artifact_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    artifact: dict[str, Any]
    source_manifest: list[SourceManifestItem] = Field(max_length=100)
    usage: WorkerUsage
    blocker: WorkerBlocker | None = None

    @model_validator(mode="after")
    def blocker_matches_status(self) -> "WorkerResultEnvelope":
        if self.status == "succeeded" and self.blocker is not None:
            raise ValueError("Successful results cannot include a blocker")
        if self.status != "succeeded" and self.blocker is None:
            raise ValueError("Blocked and failed results require a safe blocker")
        if self.status == "succeeded" and self.output_type == "discovery":
            DiscoveryArtifact.model_validate(self.artifact)
        return self

    def verify_artifact_digest(self) -> None:
        payload = canonical_bytes(self.artifact)
        if len(payload) > 20_000_000:
            raise ValueError("Worker artifact exceeds the maximum size")
        if hashlib.sha256(payload).hexdigest() != self.artifact_sha256:
            raise ValueError("Worker artifact digest does not match the payload")


class ClaimedStep(ApiModel):
    step_id: str
    run_id: str
    attempt: int
    kind: Literal["investor_research"]
    input: dict[str, Any]
    budget_usd: float
    spent_usd: float


class WorkerJob(ApiModel):
    run_id: str
    step_id: str
    attempt: int
    kind: Literal["investor_research"]
    input: dict[str, Any]
    template_version: str
    worker_version: str


class DispatchResult(ApiModel):
    status: Literal["idle", "succeeded", "blocked", "failed"]
    run_id: str | None = None
    step_id: str | None = None
    sandbox_id: str | None = None


class ExaSearchRequest(ApiModel):
    step_id: str = Field(min_length=1, max_length=100)
    attempt: int = Field(gt=0, le=10)
    operation_key: str = Field(min_length=16, max_length=256)
    query: str = Field(min_length=8, max_length=500)
    num_results: int = Field(default=10, ge=1, le=20)


class AddonManifest(ApiModel):
    key: str
    version: str
    input_schema_version: str
    output_schema_version: str
    allowed_tools: list[str]
    network_profile: str
    max_runtime_seconds: int
    max_output_bytes: int
    required_approvals: list[str]
    provider_budget_usd: float


def canonical_sha256(value: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def canonical_bytes(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
