import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata: Metadata = { title: "Operator metrics", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminDashboard />;
}
