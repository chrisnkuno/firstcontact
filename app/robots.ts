import type { MetadataRoute } from "next";

// Static export: metadata routes are generated once at build time rather than
// per request, so they must opt in explicitly. GitHub Pages has no server to
// evaluate them on demand.
export const dynamic = "force-static";

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/investor", "/signin"] }, sitemap: `${origin()}/sitemap.xml` }; }
