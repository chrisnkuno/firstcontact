import { z } from "zod";

export const regions = ["Africa", "Latin America", "MENA", "South Asia", "Southeast Asia", "Other"] as const;
export const capitalRegions = ["US", "UK", "EU", "APAC"] as const;
export const stages = ["pre-seed", "seed", "series-a", "series-b+", "growth", "institutional"] as const;
export const organizationTypes = ["startup", "institution"] as const;
export const signupTypes = ["startup", "institution", "individual"] as const;
export const individualRoles = ["founder", "investor", "operator", "advisor", "researcher", "other"] as const;
export const participationGoals = [
  "raise-capital",
  "find-investors",
  "join-catalogue",
  "invest",
  "mentor",
  "partner",
  "research",
] as const;
export const referralSources = ["search", "social", "community", "referral", "event", "other"] as const;

export const startupProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  organizationType: z.enum(organizationTypes),
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

const optionalUrl = z.union([z.literal(""), z.string().url()]).optional().transform((value) => value || undefined);

export const interestSignupSchema = z.object({
  accountType: z.enum(signupTypes),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  location: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().max(120).optional(),
  website: optionalUrl,
  individualRole: z.enum(individualRoles).optional(),
  stage: z.enum(stages).optional(),
  summary: z.string().trim().min(20).max(700),
  context: z.string().trim().min(20).max(1200),
  goals: z.array(z.enum(participationGoals)).min(1).max(5),
  targetRegions: z.array(z.enum(capitalRegions)).max(4),
  referralSource: z.enum(referralSources),
  consentToProcess: z.literal(true),
  productUpdates: z.boolean(),
}).superRefine((value, context) => {
  if (value.accountType === "individual" && !value.individualRole) {
    context.addIssue({
      code: "custom",
      path: ["individualRole"],
      message: "Choose the role that best describes you",
    });
  }

  if (value.accountType !== "individual" && !value.organizationName?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["organizationName"],
      message: "Organization name is required",
    });
  }

  if (value.accountType === "startup" && !value.stage) {
    context.addIssue({
      code: "custom",
      path: ["stage"],
      message: "Choose your current stage",
    });
  }
});

export type InterestSignup = z.infer<typeof interestSignupSchema>;

export const catalogueInterestSchema = z.object({
  profileId: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(254),
  note: z.string().trim().max(500).optional().transform((value) => value || undefined),
});

export type CatalogueInterest = z.infer<typeof catalogueInterestSchema>;

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
