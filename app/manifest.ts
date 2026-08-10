import type { MetadataRoute } from "next";

// Static export: metadata routes are generated once at build time rather than
// per request, so they must opt in explicitly. GitHub Pages has no server to
// evaluate them on demand.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest { return { name: "FirstContact", short_name: "FirstContact", description: "Open infrastructure for capital access beyond capital-dense ecosystems.", start_url: "/", display: "standalone", background_color: "#f2f0e9", theme_color: "#10231c", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] }; }
