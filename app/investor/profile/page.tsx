import type { Metadata } from "next";
import { InvestorProfilePage } from "@/components/account-profile";

export const metadata: Metadata = { title: "Your profile", robots: { index: false, follow: false } };

export default function InvestorProfileRoute() {
  return <InvestorProfilePage />;
}
