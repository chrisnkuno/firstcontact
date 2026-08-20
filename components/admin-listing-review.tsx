"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check, Inbox, Loader2, X } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Operator review of founder-submitted catalogue listings.
 *
 * The only transition an operator owns is `review → listed` (or back to
 * private). They cannot reach into a founder's private draft and publish it,
 * and they cannot stop a founder withdrawing something already public — both
 * of those are enforced in `convex/catalogue.ts`, not here.
 *
 * Every decision is written to the admin audit log against the acting account,
 * which is why the reject path asks for a reason: "why was this refused" is the
 * question that gets asked weeks later, and an empty audit row cannot answer it.
 */
export function AdminListingReview() {
  const queue = useQuery(api.catalogue.reviewQueue);
  const decide = useMutation(api.catalogue.decideListing);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  if (queue === undefined) {
    return <p className="dashboard-loading">Loading the review queue…</p>;
  }

  async function act(listingId: string, approve: boolean) {
    setPending(listingId);
    setError(null);
    try {
      await decide({
        listingId: listingId as Parameters<typeof decide>[0]["listingId"],
        approve,
        reason: reasons[listingId]?.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record that decision.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="workspace">
      <header className="workspace-head">
        <h1>Listing review</h1>
        <p>
          Listings founders have submitted for publication. Approving one makes it visible to every
          investor browsing the catalogue, so read the open questions as carefully as the strengths.
        </p>
      </header>

      {error && (
        <p className="auth-error" role="alert">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

      {queue.length === 0 ? (
        <section className="workspace-section">
          <p className="workspace-empty">
            <Inbox size={15} /> Nothing is waiting for review.
          </p>
        </section>
      ) : (
        queue.map((listing) => (
          <section className="workspace-section" key={listing.id}>
            <header>
              <span>{listing.organizationName ?? "Unknown organization"}</span>
              <h2>{listing.name ?? "Untitled"}</h2>
              <p>
                {listing.oneLiner}
                {listing.website && (
                  <>
                    {" · "}
                    <a href={listing.website} target="_blank" rel="noreferrer noopener">
                      {listing.website}
                    </a>
                  </>
                )}
              </p>
            </header>

            <dl className="review-facts">
              <div>
                <dt>Stage</dt>
                <dd>{listing.stage ?? "—"}</dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{listing.region ?? "—"}</dd>
              </div>
              <div>
                <dt>Sectors</dt>
                <dd>{listing.sectors.length > 0 ? listing.sectors.join(", ") : "—"}</dd>
              </div>
            </dl>

            <h3 className="review-heading">Operating context</h3>
            <p className="workspace-note-text">{listing.publicContext}</p>

            {listing.publicStrengths.length > 0 && (
              <>
                <h3 className="review-heading">Strengths</h3>
                <ul className="review-list">
                  {listing.publicStrengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {listing.publicConsiderations.length > 0 && (
              <>
                <h3 className="review-heading">Open questions</h3>
                <ul className="review-list">
                  {listing.publicConsiderations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {listing.publicTraction && (
              <>
                <h3 className="review-heading">Traction</h3>
                <p className="workspace-note-text">{listing.publicTraction}</p>
              </>
            )}

            <label className="review-reason">
              Reason <em>(recorded in the audit log; required in practice for a rejection)</em>
              <input
                type="text"
                maxLength={500}
                value={reasons[listing.id] ?? ""}
                onChange={(event) =>
                  setReasons((previous) => ({ ...previous, [listing.id]: event.target.value }))
                }
              />
            </label>

            <div className="workspace-actions">
              <button
                className="button button-dark"
                type="button"
                disabled={pending !== null}
                onClick={() => act(listing.id, true)}
              >
                {pending === listing.id ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                Publish
              </button>
              <button
                className="button"
                type="button"
                disabled={pending !== null}
                onClick={() => act(listing.id, false)}
              >
                <X size={15} /> Send back
              </button>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
