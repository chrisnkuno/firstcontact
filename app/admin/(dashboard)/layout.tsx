import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminMfaState } from "@/lib/admin-data";
import { AdminLogoutButton } from "@/components/admin-logout-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();
  const mfaState = await getAdminMfaState(session.adminUserId);
  if (!mfaState?.mfaEnabled) redirect("/admin/mfa/setup");

  return (
    <main id="main-content">
      <header className="simple-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, font: "600 13px var(--font-mono)" }}>
          <ShieldCheck size={18} /> TECHADMIN
        </div>
        <nav className="admin-nav">
          <Link href="/admin">Metrics</Link>
          <Link href="/admin/pipeline">Pipeline</Link>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{session.email}</span>
          <AdminLogoutButton />
        </nav>
      </header>
      <div className="admin-shell section-shell">{children}</div>
    </main>
  );
}
