"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { AccountRole } from "@/lib/domain";
import { isConvexConfigured } from "@/lib/convex-endpoints";
import { SignOutButton } from "@/components/auth-forms";
import { Logo } from "@/components/logo";

export type Viewer = NonNullable<ReturnType<typeof useViewer>>;

function useViewer() {
  return useQuery(api.users.viewer);
}

/**
 * Authentication and role gate for every dashboard.
 *
 * On a statically exported site there is no server-side redirect, so the gate
 * necessarily runs in the browser: the page ships to everyone and the *data*
 * is what is protected. That is safe because every Convex query behind these
 * screens enforces its own authorization — the gate here is a user-experience
 * affordance, not the security boundary. Treating it as the boundary would be
 * the classic client-side-auth mistake.
 */
export function DashboardShell(props: {
  allow: readonly AccountRole[];
  label: string;
  children: (viewer: Viewer) => ReactNode;
  nav?: ReactNode;
}) {
  // Checked before mounting anything that calls a Convex hook, matching the
  // guard every other Convex-reading component uses. Without it, a build with
  // no deployment configured would throw on render instead of explaining
  // itself — and there is no ConvexProvider above us to throw against.
  if (!isConvexConfigured) {
    return (
      <main id="main-content" className="dashboard-shell">
        <div className="dashboard-blocked" role="alert">
          <ShieldAlert size={20} />
          <div>
            <b>This build has no backend configured.</b>
            <p>
              <code>NEXT_PUBLIC_CONVEX_URL</code> was not set at build time, so accounts and
              dashboards cannot work. Rebuild with it pointing at a Convex deployment.
            </p>
          </div>
        </div>
      </main>
    );
  }
  return <DashboardShellInner {...props} />;
}

function DashboardShellInner({
  allow,
  label,
  children,
  nav,
}: {
  allow: readonly AccountRole[];
  label: string;
  children: (viewer: Viewer) => ReactNode;
  nav?: ReactNode;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useViewer();
  const router = useRouter();
  const claimSignup = useMutation(api.users.claimSignupRecord);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/signin");
  }, [isLoading, isAuthenticated, router]);

  // Links the pre-account interest submission to this account, and refreshes
  // the "last seen" stamp that the admin engagement metric reads.
  useEffect(() => {
    if (isAuthenticated) void claimSignup({});
  }, [isAuthenticated, claimSignup]);

  if (isLoading || (isAuthenticated && viewer === undefined)) {
    return (
      <main id="main-content" className="dashboard-shell">
        <p className="dashboard-loading">
          <Loader2 size={16} className="spin" /> Loading your dashboard…
        </p>
      </main>
    );
  }

  if (!isAuthenticated || !viewer) {
    return (
      <main id="main-content" className="dashboard-shell">
        <p className="dashboard-loading">Redirecting to sign in…</p>
      </main>
    );
  }

  if (viewer.suspended) {
    return (
      <main id="main-content" className="dashboard-shell">
        <div className="dashboard-blocked" role="alert">
          <ShieldAlert size={20} />
          <div>
            <b>This account is suspended.</b>
            <p>Contact the operators if you believe this is a mistake.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!allow.includes(viewer.role)) {
    const home = viewer.role === "investor" ? "/investor" : viewer.role === "admin" ? "/admin" : "/dashboard";
    return (
      <main id="main-content" className="dashboard-shell">
        <div className="dashboard-blocked" role="alert">
          <ShieldAlert size={20} />
          <div>
            <b>This area is for a different kind of account.</b>
            <p>
              You are signed in as <strong>{viewer.role}</strong>.{" "}
              <Link href={home}>Go to your dashboard</Link>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content">
      <header className="dashboard-topbar">
        <Logo />
        <span className="dashboard-topbar-label">{label}</span>
        <nav>
          {nav}
          <span className="dashboard-topbar-email">{viewer.email}</span>
          <SignOutButton />
        </nav>
      </header>
      <div className="dashboard-shell">{children(viewer)}</div>
    </main>
  );
}
