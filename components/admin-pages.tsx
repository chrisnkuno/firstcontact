"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminMfaGate, AdminSecurityPanel } from "@/components/admin-mfa";
import { AdminPipelineTable } from "@/components/admin-pipeline-table";
import { AdminListingReview } from "@/components/admin-listing-review";
import { AdminErrors } from "@/components/admin-errors";

const nav = (
  <>
    <Link href="/admin">Metrics</Link>
    <Link href="/admin/pipeline">Pipeline</Link>
    <Link href="/admin/listings">Listings</Link>
    <Link href="/admin/errors">Errors</Link>
    <Link href="/admin/mfa">Security</Link>
  </>
);

export function AdminPipelinePage() {
  return (
    <DashboardShell allow={["admin"]} label="OPERATOR" nav={nav}>
      {(viewer) => (
        <AdminMfaGate mfa={viewer.mfa}>
          <AdminPipelineTable />
        </AdminMfaGate>
      )}
    </DashboardShell>
  );
}

/* The security page is deliberately NOT behind AdminMfaGate: it is where an
   admin goes to enrol or to end step-up, and gating it behind step-up would
   make enrolment unreachable for a newly promoted account. */
export function AdminSecurityPage() {
  return (
    <DashboardShell allow={["admin"]} label="OPERATOR" nav={nav}>
      {(viewer) => <AdminSecurityPanel mfa={viewer.mfa} />}
    </DashboardShell>
  );
}

/* Behind AdminMfaGate for the same reason the pipeline is: publishing a
   listing makes a real organization visible to every investor, which is
   exactly the class of action step-up exists to protect. */
export function AdminListingsPage() {
  return (
    <DashboardShell allow={["admin"]} label="OPERATOR" nav={nav}>
      {(viewer) => (
        <AdminMfaGate mfa={viewer.mfa}>
          <AdminListingReview />
        </AdminMfaGate>
      )}
    </DashboardShell>
  );
}

export function AdminErrorsPage() {
  return (
    <DashboardShell allow={["admin"]} label="OPERATOR" nav={nav}>
      {(viewer) => (
        <AdminMfaGate mfa={viewer.mfa}>
          <AdminErrors />
        </AdminMfaGate>
      )}
    </DashboardShell>
  );
}
