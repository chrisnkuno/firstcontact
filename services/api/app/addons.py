from app.models import AddonManifest

INVESTOR_RESEARCH_PLAN = AddonManifest(
    key="investor_research_plan",
    version="0.1.0",
    input_schema_version="workflow-run-v1",
    output_schema_version="research-plan-v1",
    allowed_tools=["python"],
    network_profile="offline",
    max_runtime_seconds=180,
    max_output_bytes=1_000_000,
    required_approvals=[],
    provider_budget_usd=2,
)

ADDONS = {INVESTOR_RESEARCH_PLAN.key: INVESTOR_RESEARCH_PLAN}
