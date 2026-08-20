"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PUBLIC_ENDPOINTS, convexEndpoint, isConvexConfigured } from "@/lib/convex-endpoints";
import { T } from "@/components/translation-provider";

/**
 * The public catalogue.
 *
 * Previously rendered six fictional companies from `lib/catalogue-data.ts`,
 * labelled as a preview. Those are gone: every profile shown here is now a real
 * `catalogueListings` row that a founder explicitly set to `listed`, carrying
 * only the fields they approved for publication.
 *
 * The cost of that is an empty catalogue until real founders publish, and this
 * component leans into it — an honest empty state is the correct rendering of
 * "no one has published yet". Fictional companies live in `scripts/seed-dev.mjs`
 * for local development.
 */

const REGIONS = ["All regions", "Africa", "Latin America", "MENA", "South Asia", "Southeast Asia"];

type Listing = NonNullable<ReturnType<typeof useListings>>[number];

function useListings() {
  return useQuery(api.catalogue.listPublished);
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  notation: "compact",
});

type InterestPhase = "idle" | "form" | "sending" | "sent" | "error";

export function Catalogue() {
  return (
    <main className="catalogue-page" id="main-content">
      <header className="catalogue-header">
        <Logo />
        <nav>
          <Link href="/">
            <ArrowLeft size={14} /> <T>Home</T>
          </Link>
          <Link href="/dashboard">
            <T>Your dashboard</T>
          </Link>
          <a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <LanguageSwitcher />
        </nav>
        <span>INVESTOR VIEW</span>
      </header>

      <section className="catalogue-intro">
        <div>
          <span>CURATED OPPORTUNITY FLOW / 01</span>
          <h1>
            <T>Context before</T>
            <br />
            <em>
              <T>the pitch.</T>
            </em>
          </h1>
        </div>
        <div>
          <p>
            <T>
              Explore founder-approved profiles from ecosystems that conventional deal flow often
              misses. Understand the operating context, strengths, open questions, and capital fit
              before requesting an introduction.
            </T>
          </p>
          <small>
            <T>
              Every profile here was published by the organization itself, showing only the fields it
              approved for display. Nothing is scraped, and nothing appears without consent.
            </T>
          </small>
        </div>
      </section>

      {isConvexConfigured ? <CatalogueBody /> : <CatalogueUnavailable />}

      <footer className="catalogue-footer">
        <p>
          <T>Want to be considered for the catalogue?</T>
        </p>
        <Link className="button button-dark" href="/signup">
          <T>Create your profile</T> <ArrowRight size={16} />
        </Link>
      </footer>
    </main>
  );
}

function CatalogueUnavailable() {
  return (
    <section className="catalogue-empty">
      <h2>
        <T>The catalogue is not connected in this environment.</T>
      </h2>
      <p>
        <T>
          Listings come from a Convex deployment. This build has none configured, so the catalogue
          shows nothing rather than sample companies that do not exist.
        </T>
      </p>
    </section>
  );
}

function CatalogueBody() {
  const listings = useListings();
  // A signed-in investor gets the attributed path: their interest becomes a
  // row the founder can see, answer and act on. Everyone else keeps the
  // anonymous email signal, which is a real record but reaches no inbox.
  const viewer = useQuery(api.users.viewer);
  const expressInterest = useMutation(api.investors.expressInterest);
  const signedInAsInvestor = viewer?.role === "investor";
  const [region, setRegion] = useState("All regions");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [interestPhase, setInterestPhase] = useState<InterestPhase>("idle");
  const [interestEmail, setInterestEmail] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [interestError, setInterestError] = useState("");

  const visible = useMemo(
    () => (listings ?? []).filter((listing) => region === "All regions" || listing.region === region),
    [listings, region],
  );

  function openProfile(listing: Listing) {
    setSelected(listing);
    setInterestPhase("idle");
    setInterestEmail("");
    setInterestNote("");
    setInterestError("");
  }

  async function sendInterest(listingId: string) {
    setInterestPhase("sending");
    setInterestError("");
    try {
      if (signedInAsInvestor) {
        await expressInterest({
          listingId: listingId as Parameters<typeof expressInterest>[0]["listingId"],
          note: interestNote || undefined,
        });
        setInterestPhase("sent");
        return;
      }

      const endpoint = convexEndpoint(PUBLIC_ENDPOINTS.catalogueInterest);
      if (!endpoint) throw new Error("This build has no backend configured.");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: listingId, email: interestEmail, note: interestNote }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Your interest could not be saved.");
      }
      setInterestPhase("sent");
    } catch (submissionError) {
      setInterestError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your interest could not be saved.",
      );
      setInterestPhase("error");
    }
  }

  if (listings === undefined) {
    return (
      <section className="catalogue-empty">
        <p>
          <T>Loading published profiles…</T>
        </p>
      </section>
    );
  }

  if (listings.length === 0) {
    return (
      <section className="catalogue-empty">
        <h2>
          <T>No profiles are published yet.</T>
        </h2>
        <p>
          <T>
            The catalogue lists organizations that have chosen to be listed and approved exactly what
            appears. Until one does, there is nothing here — deliberately, rather than filling the
            space with examples.
          </T>
        </p>
        <Link className="button button-dark" href="/signup">
          <T>Be the first</T> <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="catalogue-controls">
        <label>
          <MapPin size={14} />
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            {REGIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <span>
          <SlidersHorizontal size={13} /> {visible.length.toString().padStart(2, "0")} PROFILES
        </span>
      </section>

      <motion.section layout className="catalogue-grid">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((listing, index) => (
            <motion.button
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              key={listing.id}
              className={`catalogue-card card-${index % 5}`}
              onClick={() => openProfile(listing)}
            >
              <div className="catalogue-card-top">
                <span>
                  {(listing.stage ?? "").toUpperCase()}
                </span>
                <i />
              </div>
              <h2>{listing.name ?? "Unnamed organization"}</h2>
              <p>{listing.oneLiner}</p>
              <div className="catalogue-tags">
                {listing.sectors.map((sector) => (
                  <span key={sector}>{sector}</span>
                ))}
              </div>
              <div className="catalogue-card-bottom">
                <span>{listing.location}</span>
                <b>{listing.raiseAmountUsd !== null ? usd.format(listing.raiseAmountUsd) : "—"}</b>
              </div>
              <ArrowRight className="card-arrow" />
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.section>

      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              aria-label="Close profile"
              className="drawer-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.aside
              className="catalogue-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <button className="drawer-close" onClick={() => setSelected(null)}>
                <X size={17} /> CLOSE
              </button>
              <h2>{selected.name ?? "Unnamed organization"}</h2>
              <p className="drawer-location">
                <MapPin size={13} /> {selected.location} · {selected.stage}
              </p>
              <p className="drawer-lead">{selected.oneLiner}</p>

              <section>
                <span>WHY CONTEXT MATTERS</span>
                <p>{selected.publicContext}</p>
              </section>

              <div className="drawer-columns">
                <section>
                  <span>STRENGTHS</span>
                  {selected.publicStrengths.map((item) => (
                    <p key={item}>
                      <Check size={13} /> {item}
                    </p>
                  ))}
                </section>
                <section className="considerations">
                  <span>OPEN QUESTIONS</span>
                  {selected.publicConsiderations.map((item) => (
                    <p key={item}>— {item}</p>
                  ))}
                </section>
              </div>

              <div className="deal-strip">
                <div>
                  <span>TRACTION</span>
                  <b>{selected.publicTraction}</b>
                </div>
                <div>
                  <span>SEEKING</span>
                  <b>{selected.raiseAmountUsd !== null ? usd.format(selected.raiseAmountUsd) : "—"}</b>
                </div>
              </div>

              {interestPhase === "idle" && (
                <button className="button button-accent drawer-action" onClick={() => setInterestPhase("form")}>
                  <T>Express interest</T> <ArrowRight size={16} />
                </button>
              )}

              {(interestPhase === "form" || interestPhase === "sending" || interestPhase === "error") && (
                <form
                  className="interest-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendInterest(selected.id);
                  }}
                >
                  {signedInAsInvestor ? (
                    <p className="interest-signed-in">
                      <T>Sending as</T> <strong>{viewer?.name ?? viewer?.email}</strong>.{" "}
                      <T>The founder sees this in their inbox and can respond to you directly.</T>
                    </p>
                  ) : (
                    <label>
                      <T>Your email</T>
                      <input
                        required
                        type="email"
                        value={interestEmail}
                        onChange={(event) => setInterestEmail(event.target.value)}
                        placeholder="you@fund.com"
                        autoComplete="email"
                      />
                      <small>
                        <Link href="/signin">
                          <T>Sign in as an investor</T>
                        </Link>{" "}
                        <T>to send this to the founder directly instead.</T>
                      </small>
                    </label>
                  )}
                  <label>
                    <T>Note</T> <small>OPTIONAL</small>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={interestNote}
                      onChange={(event) => setInterestNote(event.target.value)}
                      placeholder="A short note the team will see alongside your interest."
                    />
                  </label>
                  {interestPhase === "error" && <p className="interest-error">{interestError}</p>}
                  <button
                    className="button button-accent drawer-action"
                    type="submit"
                    disabled={interestPhase === "sending"}
                  >
                    {interestPhase === "sending" ? (
                      <>
                        <LoaderCircle className="spin" size={16} /> <T>Sending</T>
                      </>
                    ) : (
                      <>
                        <T>Send interest</T> <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {interestPhase === "sent" && (
                <div className="interest-confirm">
                  <Check size={20} />
                  <div>
                    <b>
                      <T>Interest recorded.</T>
                    </b>
                    <p>
                      {signedInAsInvestor ? (
                        <T>
                          Delivered to the founder&apos;s inbox. They decide whether to accept, and
                          nothing about you is shared beyond your name and note until they do.
                        </T>
                      ) : (
                        <T>
                          Saved as a real, timestamped signal against this profile. No private founder
                          contact data is exposed to you — the organization decides whether to respond.
                        </T>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <small className="verified-line">
                <T>Public fields approved for catalogue display by the organization</T>
              </small>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
