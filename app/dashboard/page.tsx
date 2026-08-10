import type { Metadata } from "next";
import { ParticipantDashboard } from "@/components/participant-dashboard";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default function DashboardPage() {
  return <ParticipantDashboard />;
}
