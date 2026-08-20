"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex-endpoints";

/**
 * Route-level error boundary.
 *
 * `components/error-reporter.tsx` catches uncaught *window* errors, but a React
 * render error is caught by React and never reaches `window.onerror` — without
 * this, the most visible class of failure would be the one the operator never
 * heard about.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="dashboard-shell">
      {isConvexConfigured && <ReportRenderError error={error} />}
      <div className="dashboard-blocked" role="alert">
        <div>
          <b>Something on this page failed to load.</b>
          <p>
            The failure has been reported. You can try again, or go back to the{" "}
            <Link href="/">home page</Link>.
          </p>
          <button className="button button-dark" type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}

function ReportRenderError({ error }: { error: Error & { digest?: string } }) {
  const convex = useConvex();
  useEffect(() => {
    void convex
      .mutation(api.observability.reportClientError, {
        message: `Render error: ${error.stack ?? error.message}`,
        route: window.location.pathname,
      })
      .catch(() => {});
  }, [convex, error]);
  return null;
}
