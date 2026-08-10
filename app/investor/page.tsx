import type { Metadata } from "next";
import { InvestorDashboard } from "@/components/investor-dashboard";

export const metadata: Metadata = { title: "Investor dashboard", robots: { index: false, follow: false } };

export default function InvestorPage() {
  return <InvestorDashboard />;
}
