import type { Metadata } from "next";
import { FounderWorkspacePage } from "@/components/founder-workspace";

export const metadata: Metadata = {
  title: "Your listing",
  robots: { index: false, follow: false },
};

export default function OrganizationRoute() {
  return <FounderWorkspacePage />;
}
