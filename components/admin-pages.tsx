"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminMfaGate, AdminSecurityPanel } from "@/components/admin-mfa";
import { AdminPipelineTable } from "@/components/admin-pipeline-table";

const nav = (
  <>
    <Link href="/admin">Metrics</Link>
    <Link href="/admin/pipeline">Pipeline</Link>
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
