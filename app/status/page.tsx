import type { Metadata } from "next";
import { getFounderSession } from "@/lib/founder-auth";
import { getMyStatus } from "@/lib/founder-data";
import { FounderLoginForm } from "@/components/founder-login-form";
import { FounderDashboard } from "@/components/founder-dashboard";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

export default async function StatusPage() {
  const session = await getFounderSession();

  return (
    <main id="main-content">
      {session ? <FounderDashboard email={session.email} status={await getMyStatus(session.founderAccountId)} /> : <FounderLoginForm />}
    </main>
  );
}
