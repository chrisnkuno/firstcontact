import { describe, expect, it } from "vitest";
import { scoreInvestor } from "@/lib/matching";
import type { Investor, StartupProfile } from "@/lib/domain";

const profile: StartupProfile = { name: "Kivu Grid", website: "https://example.org", location: "Kigali, Rwanda", region: "Africa", stage: "seed", sectors: ["climate", "energy"], raiseAmountUsd: 1500000, oneLiner: "Distributed energy intelligence for commercial buildings.", traction: "Twenty paid sites and twelve months of measured operating data.", impact: "Lower energy cost and diesel use for growing businesses.", founderContext: "The team has operated regional infrastructure for ten years.", targetRegions: ["US", "UK", "EU"], consentToProcess: true };
const investor: Investor = { id: "i1", firm: "Aligned", region: "EU", website: "https://example.com", sourceUrl: "https://example.com/thesis", thesis: "Climate in Africa", stages: ["seed"], sectors: ["climate"], geographies: ["Africa"], contactType: "generic_business", evidence: ["Public thesis"], discoveredAt: new Date(0).toISOString() };

describe("transparent matching", () => {
  it("scores explicit overlaps and exposes reasons", () => { const result = scoreInvestor(profile, investor); expect(result.score).toBe(95); expect(result.reasons).toContain("Geography mandate overlap"); expect(result.risks).toHaveLength(0); });
});
