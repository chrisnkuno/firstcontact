import type { MetadataRoute } from "next";

// Static export: metadata routes are generated once at build time rather than
// per request, so they must opt in explicitly. GitHub Pages has no server to
// evaluate them on demand.
export const dynamic = "force-static";

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/signup", "/dashboard", "/catalogue", "/plan", "/pacing", "/research/private-equity", "/how-it-works", "/system", "/principles", "/for-founders", "/for-investors", "/open-source", "/responsible-outreach", "/privacy", "/terms", "/security"].map((path) => ({ url: `${origin()}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : path === "/signup" || path === "/catalogue" || path === "/plan" || path === "/pacing" ? .9 : .6 }));
}
