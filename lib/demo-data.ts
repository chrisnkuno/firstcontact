import type { Match, PipelineEvent } from "@/lib/domain";

export const demoMatches: Match[] = [
  {
    id: "fc_001", firm: "Equator", person: "Africa investment team", role: "Investor", region: "UK",
    website: "https://www.equator.vc", sourceUrl: "https://www.equator.vc", contactType: "generic_business",
    thesis: "Climate technology ventures building in or for Sub-Saharan Africa.", stages: ["seed", "series-a"],
    sectors: ["climate", "energy", "mobility"], geographies: ["Africa"], email: "team@equator.vc",
    evidence: ["Africa-focused climate fund", "Seed-stage mandate", "Operational climate thesis"],
    discoveredAt: "2026-07-23T08:00:00.000Z", score: 94,
    reasons: ["Direct geography fit", "Stage overlap", "Climate thesis alignment"], risks: [],
  },
  {
    id: "fc_002", firm: "Partech Africa", person: "Investment team", role: "Investor", region: "EU",
    website: "https://partechpartners.com", sourceUrl: "https://partechpartners.com", contactType: "generic_business",
    thesis: "Technology companies serving large and growing markets across Africa.", stages: ["seed", "series-a", "series-b+"],
    sectors: ["software", "fintech", "commerce"], geographies: ["Africa"],
    evidence: ["Dedicated Africa strategy", "Multi-stage investment profile", "Pan-African portfolio"],
    discoveredAt: "2026-07-23T08:02:00.000Z", score: 89,
    reasons: ["Africa mandate", "Market-expansion experience", "Stage overlap"], risks: ["Sector fit needs review"],
  },
  {
    id: "fc_003", firm: "Global Innovation Fund", person: "Investment team", role: "Investor", region: "US",
    website: "https://www.globalinnovation.fund", sourceUrl: "https://www.globalinnovation.fund", contactType: "generic_business",
    thesis: "Evidence-backed innovations improving lives in lower-income countries.", stages: ["seed", "growth", "institutional"],
    sectors: ["impact", "climate", "health", "education"], geographies: ["Emerging markets"],
    evidence: ["Development-impact mandate", "Flexible capital", "Evidence-oriented selection"],
    discoveredAt: "2026-07-23T08:04:00.000Z", score: 86,
    reasons: ["Impact mandate", "Emerging-market focus", "Flexible instrument potential"], risks: ["Requires measurable impact case"],
  },
];

export const demoEvents: PipelineEvent[] = [
  { id: "e1", type: "discovered", label: "42 source-backed investors discovered", timestamp: "09:12" },
  { id: "e2", type: "matched", label: "18 passed thesis and geography checks", timestamp: "09:14" },
  { id: "e3", type: "drafted", label: "8 personalized introductions drafted", timestamp: "09:16" },
  { id: "e4", type: "approved", label: "Awaiting founder review and approval", timestamp: "Now" },
];
