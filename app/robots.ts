import type { MetadataRoute } from "next";
import { siteOrigin as origin } from "@/lib/site-config";

// Static export: metadata routes are generated once at build time rather than
// per request, so they must opt in explicitly. GitHub Pages has no server to
// evaluate them on demand.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/investor", "/signin"] }, sitemap: `${origin()}/sitemap.xml` }; }
