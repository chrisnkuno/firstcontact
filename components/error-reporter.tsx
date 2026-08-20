"use client";

import { useEffect, useRef } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex-endpoints";

/**
 * Captures uncaught browser errors and reports them, redacted, to Convex.
 *
 * On a statically exported site there is no server log to tail: an exception in
 * a user's browser leaves no trace anywhere the operator can see, which is why
 * "a production failure is discovered by a user reporting it" was true.
 *
 * Three things keep this from becoming a liability of its own:
 *
 *  - The message is redacted server-side, before storage, by `lib/redaction.ts`.
 *    Nothing here decides what is safe to keep.
 *  - Reporting is best-effort and silent. A failure to report an error must
 *    never itself surface an error, or a backend outage becomes an infinite
 *    loop of failed reports about failed reports.
 *  - Identical messages are suppressed locally for the lifetime of the page, so
 *    an error inside a render loop sends one report rather than thousands.
 */

/** Local de-duplication cap, independent of the server-side fingerprinting. */
const MAX_REPORTS_PER_PAGE = 10;

export function ErrorReporter() {
  // Rendered from the root layout, which is above the Convex provider check —
  // so a build with no backend must not call a Convex hook at all.
  if (!isConvexConfigured) return null;
  return <ErrorReporterInner />;
}

function ErrorReporterInner() {
  const convex = useConvex();
  const seen = useRef(new Set<string>());
  const sent = useRef(0);

  useEffect(() => {
    function report(message: string) {
      if (sent.current >= MAX_REPORTS_PER_PAGE) return;
      if (seen.current.has(message)) return;
      seen.current.add(message);
      sent.current += 1;

      // Deliberately floating and silent: see the note above.
      void convex
        .mutation(api.observability.reportClientError, {
          message,
          route: window.location.pathname,
        })
        .catch(() => {});
    }

    function onError(event: ErrorEvent) {
      const detail = event.error instanceof Error ? event.error.stack : undefined;
      report(detail || event.message || "Unknown error");
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const detail =
        reason instanceof Error ? (reason.stack ?? reason.message) : String(reason ?? "Unknown");
      report(`Unhandled rejection: ${detail}`);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [convex]);

  return null;
}
