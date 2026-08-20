import type { Metadata } from "next";
import { AdminErrorsPage } from "@/components/admin-pages";

export const metadata: Metadata = { title: "Errors", robots: { index: false, follow: false } };

export default function AdminErrorsRoute() {
  return <AdminErrorsPage />;
}
