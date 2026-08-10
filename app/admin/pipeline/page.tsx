import type { Metadata } from "next";
import { AdminPipelinePage } from "@/components/admin-pages";

export const metadata: Metadata = { title: "Intake pipeline", robots: { index: false, follow: false } };

export default function PipelinePage() {
  return <AdminPipelinePage />;
}
