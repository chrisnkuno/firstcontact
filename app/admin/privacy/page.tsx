import type { Metadata } from "next";
import { AdminPrivacyPage } from "@/components/admin-pages";

export const metadata: Metadata = { title: "Privacy requests", robots: { index: false, follow: false } };
export default function AdminPrivacyRoute() { return <AdminPrivacyPage />; }
