import { z } from "zod";

export const regions = ["Africa", "Latin America", "MENA", "South Asia", "Southeast Asia", "Other"] as const;
export const capitalRegions = ["US", "UK", "EU", "APAC"] as const;
export const stages = ["pre-seed", "seed", "series-a", "series-b+", "growth", "institutional"] as const;

export const startupProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  website: z.string().url(),
  location: z.string().trim().min(2).max(120),
  region: z.enum(regions),
  stage: z.enum(stages),
  sectors: z.array(z.string().trim().min(2)).min(1).max(5),
  raiseAmountUsd: z.number().int().positive().max(1_000_000_000),
  oneLiner: z.string().trim().min(20).max(240),
  traction: z.string().trim().min(20).max(1200),
  impact: z.string().trim().min(20).max(1200),
  founderContext: z.string().trim().min(20).max(1600),
  targetRegions: z.array(z.enum(capitalRegions)).min(1),
  consentToProcess: z.literal(true),
});

export type StartupProfile = z.infer<typeof startupProfileSchema>;

export const investorSchema = z.object({
  id: z.string(),
  firm: z.string(),
  person: z.string().optional(),
  role: z.string().optional(),
  region: z.enum(capitalRegions),
  website: z.string().url(),
  sourceUrl: z.string().url(),
  thesis: z.string(),
  stages: z.array(z.string()),
  sectors: z.array(z.string()),
  geographies: z.array(z.string()),
  email: z.string().email().optional(),
  contactType: z.enum(["generic_business", "named_business", "unknown"]),
  evidence: z.array(z.string()),
  discoveredAt: z.string(),
});

export type Investor = z.infer<typeof investorSchema>;

export type Match = Investor & {
  score: number;
  reasons: string[];
  risks: string[];
};

export type CampaignStatus = "draft" | "review" | "approved" | "running" | "paused" | "complete";

export type PipelineEvent = {
  id: string;
  type: "discovered" | "matched" | "drafted" | "approved" | "sent" | "delivered" | "replied" | "suppressed";
  label: string;
  timestamp: string;
};
