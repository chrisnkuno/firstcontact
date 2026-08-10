import type { Metadata } from "next";
import { AdminSecurityPage } from "@/components/admin-pages";

export const metadata: Metadata = { title: "Operator security", robots: { index: false, follow: false } };

export default function AdminMfaPage() {
  return <AdminSecurityPage />;
}
