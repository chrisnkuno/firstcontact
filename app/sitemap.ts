import type { MetadataRoute } from "next";
import { siteOrigin as origin } from "@/lib/site-config";

// Static export: metadata routes are generated once at build time rather than
// per request, so they must opt in explicitly. GitHub Pages has no server to
// evaluate them on demand.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/signup", "/dashboard", "/catalogue", "/plan", "/pacing", "/research/private-equity", "/how-it-works", "/system", "/principles", "/for-founders", "/for-investors", "/open-source", "/responsible-outreach", "/privacy", "/terms", "/security"].map((path) => ({ url: `${origin()}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : path === "/signup" || path === "/catalogue" || path === "/plan" || path === "/pacing" ? .9 : .6 }));
}
