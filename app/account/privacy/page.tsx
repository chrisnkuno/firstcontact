import type { Metadata } from "next";
import { PrivacyCenterPage } from "@/components/privacy-center";

export const metadata: Metadata = { title: "Privacy center", robots: { index: false, follow: false } };

export default function AccountPrivacyPage() { return <PrivacyCenterPage />; }
