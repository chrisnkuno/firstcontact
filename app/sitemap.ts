import type { MetadataRoute } from "next";

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/signup", "/workspace", "/catalogue", "/open-source", "/responsible-outreach", "/privacy", "/terms", "/security"].map((path) => ({ url: `${origin()}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : path === "/signup" || path === "/catalogue" ? .9 : .6 }));
}
