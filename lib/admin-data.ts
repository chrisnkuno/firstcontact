import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type AdminMetrics = {
  total: number;
  byAccountType: { startup: number; institution: number; individual: number };
  byStatus: { new: number; reviewing: number; invited: number; active: number; declined: number };
  byRegion: { US: number; UK: number; EU: number; APAC: number };
  byGoal: Record<string, number>;
  last7Days: number;
  last30Days: number;
};

export type AdminSignupStatus = "new" | "reviewing" | "invited" | "active" | "declined";

export type AdminSignupRow = {
  id: string;
  accountType: "startup" | "institution" | "individual";
  name: string;
  email: string;
  location: string;
  organizationName?: string;
  individualRole?: string;
  stage?: string;
  goals: string[];
  targetRegions: string[];
  status: AdminSignupStatus;
  createdAt: number;
  updatedAt: number;
  submissionCount: number;
};

export type AdminMfaState = { mfaEnabled: boolean; mfaSecret: string | null; email: string };

const metricsRef = makeFunctionReference<"query", { adminSecret: string }, AdminMetrics>("admin:metrics");
const mfaStateRef = makeFunctionReference<
  "query",
  { adminSecret: string; adminUserId: string },
  AdminMfaState | null
>("admin:getMfaSecret");
const listRef = makeFunctionReference<
  "query",
  { adminSecret: string; status?: AdminSignupStatus; limit?: number },
  AdminSignupRow[]
>("admin:listSignupsForAdmin");

function client(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;
  return new ConvexHttpClient(convexUrl);
}

export async function getAdminMetrics(): Promise<AdminMetrics | null> {
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  const c = client();
  if (!adminSecret || !c) return null;
  try {
    return await c.query(metricsRef, { adminSecret });
  } catch {
    return null;
  }
}

export async function getAdminMfaState(adminUserId: string): Promise<AdminMfaState | null> {
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  const c = client();
  if (!adminSecret || !c) return null;
  try {
    return await c.query(mfaStateRef, { adminSecret, adminUserId });
  } catch {
    return null;
  }
}

export async function listAdminSignups(status?: AdminSignupStatus): Promise<AdminSignupRow[]> {
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  const c = client();
  if (!adminSecret || !c) return [];
  try {
    return await c.query(listRef, { adminSecret, status, limit: 100 });
  } catch {
    return [];
  }
}
