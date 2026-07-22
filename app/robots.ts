import type { MetadataRoute } from "next";

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/api/send", "/api/draft", "/api/discover", "/api/webhooks/"] }, sitemap: `${origin()}/sitemap.xml` }; }
