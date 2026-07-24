import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type MyStatus = {
  accountType: "startup" | "institution" | "individual";
  name: string;
  organizationName?: string;
  status: "new" | "reviewing" | "invited" | "active" | "declined";
  goals: string[];
  submissionCount: number;
  createdAt: number;
  updatedAt: number;
};

const getMyStatusRef = makeFunctionReference<
  "query",
  { founderSecret: string; founderAccountId: string },
  MyStatus | null
>("founder:getMyStatus");

export async function getMyStatus(founderAccountId: string): Promise<MyStatus | null> {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const founderSecret = process.env.FOUNDER_ACTION_SECRET;
  if (!convexUrl || !founderSecret) return null;

  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(getMyStatusRef, { founderSecret, founderAccountId });
  } catch {
    return null;
  }
}
