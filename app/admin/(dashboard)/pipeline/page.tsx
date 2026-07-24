import type { Metadata } from "next";
import Link from "next/link";
import { listAdminSignups, type AdminSignupStatus } from "@/lib/admin-data";
import { AdminPipelineTable } from "@/components/admin-pipeline-table";

export const metadata: Metadata = { title: "Techadmin pipeline", robots: { index: false, follow: false } };

const STATUSES: AdminSignupStatus[] = ["new", "reviewing", "invited", "active", "declined"];

function isSignupStatus(value: string | undefined): value is AdminSignupStatus {
  return STATUSES.includes(value as AdminSignupStatus);
}

export default async function AdminPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = isSignupStatus(params.status) ? params.status : undefined;
  const rows = await listAdminSignups(status);

  return (
    <>
      <div className="calc-intro">
        <span>TECHADMIN / PIPELINE</span>
        <h1>Onboard signups</h1>
        <p>Move a signup through the pipeline as you review it. Every change is written to the audit log.</p>
      </div>

      <div className="admin-filter-row">
        <Link className={!status ? "active" : ""} href="/admin/pipeline">
          All
        </Link>
        {STATUSES.map((value) => (
          <Link key={value} className={status === value ? "active" : ""} href={`/admin/pipeline?status=${value}`}>
            {value}
          </Link>
        ))}
      </div>

      <AdminPipelineTable initialRows={rows} />
    </>
  );
}
