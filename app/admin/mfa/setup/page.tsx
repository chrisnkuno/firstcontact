import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { AdminMfaSetup } from "@/components/admin-mfa-setup";

export const metadata: Metadata = {
  title: "Set up MFA",
  robots: { index: false, follow: false },
};

export default async function AdminMfaSetupPage() {
  await requireAdminSession();
  return (
    <main id="main-content">
      <AdminMfaSetup />
    </main>
  );
}
