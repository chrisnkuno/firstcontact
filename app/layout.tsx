import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FirstContact — Capital should travel further", template: "%s · FirstContact" },
  description: "Open-source infrastructure connecting overlooked founders and institutions with aligned global investors.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")),
  applicationName: "FirstContact",
  authors: [{ name: "FirstContact contributors", url: "https://github.com/chrisnkuno/firstcontact" }],
  keywords: ["venture capital", "fundraising", "startup infrastructure", "impact investing", "open source"],
  openGraph: { title: "FirstContact — Capital should travel further", description: "Open infrastructure helping overlooked founders find and thoughtfully approach aligned investors worldwide.", type: "website", siteName: "FirstContact" },
  twitter: { card: "summary_large_image", title: "FirstContact — Capital should travel further", description: "Open infrastructure for capital access beyond capital-dense ecosystems." },
};

export const viewport: Viewport = { themeColor: "#f2f0e9", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
