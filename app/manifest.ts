import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest { return { name: "FirstContact", short_name: "FirstContact", description: "Open infrastructure for capital access beyond capital-dense ecosystems.", start_url: "/", display: "standalone", background_color: "#f2f0e9", theme_color: "#10231c", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] }; }
