"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  Building2,
  Check,
  Eye,
  Inbox,
  Loader2,
  Send,
  Undo2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  capitalRegions,
  organizationTypes,
  regions,
  stages,
  type StartupProfile,
} from "@/lib/domain";

/**
 * The founder's workspace: organization → profile → listing → interest.
 *
 * This is the supply side of the marketplace, and until now none of it was
 * reachable. Every mutation it calls already existed, tested and
 * authorization-checked, with no user interface on top — so a founder could
 * create an account and then do nothing at all with it.
 *
 * The page is a linear pipeline rather than a set of tabs on purpose. Each
 * stage is a precondition for the next, and showing a listing editor to someone
 * with no organization would be offering a control that cannot work.
 */

const nav = (
  <>
    <Link href="/dashboard">Dashboard</Link>
    <Link href="/dashboard/profile">Profile</Link>
    <Link href="/plan">Planner</Link>
  </>
);

export function FounderWorkspacePage() {
  return (
    <DashboardShell allow={["participant"]} label="PARTICIPANT" nav={nav}>
      {() => <WorkspaceBody />}
    </DashboardShell>
  );
}

/** Turns a name into the url-safe slug `organizations.create` demands. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function errorText(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught);
  if (message.includes("slug is already in use")) {
    return "That organization name is already taken. Try a more specific one.";
  }
  if (message.includes("FORBIDDEN")) return "You do not have permission to do that.";
  // Zod validation failures arrive as a JSON blob; the first message in it is
  // the useful part and the rest is noise to a founder.
  const match = message.match(/"message":\s*"([^"]+)"/);
  if (match) return match[1];
  return message.replace(/^\[.*?\]\s*/, "").slice(0, 300) || "Something went wrong.";
}

function Section({
  step,
  title,
  intro,
  children,
}: {
  step: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="workspace-section">
      <header>
        <span>{step}</span>
        <h2>{title}</h2>
        <p>{intro}</p>
      </header>
      {children}
    </section>
  );
}

function WorkspaceBody() {
  const organizations = useQuery(api.organizations.listMine);
  const listing = useMyListing();
  // What this founder already told us on the public form. Waited for rather
  // than streamed in, because these forms are uncontrolled: `defaultValue`
  // only applies at mount, so a draft that arrives late would be ignored.
  const draft = useQuery(api.users.mySignupDraft);

  if (organizations === undefined || listing === undefined || draft === undefined) {
    return <p className="dashboard-loading">Loading your workspace…</p>;
  }

  const organization = organizations[0]?.organization ?? null;

  return (
    <div className="workspace">
      <header className="workspace-head">
        <h1>Your listing</h1>
        <p>
          Four steps from an account to a profile an investor can find. Nothing here is published
          until you submit it and an operator reviews it, and you can take it down at any time.
        </p>
      </header>

      {!organization ? (
        <CreateOrganization draft={draft} />
      ) : !listing ? (
        <>
          <OrganizationSummary name={organization.name} slug={organization.slug} />
          <CreateProfile organizationId={organization._id} draft={draft} />
        </>
      ) : (
        <>
          <OrganizationSummary name={organization.name} slug={organization.slug} />
          <ListingEditor listing={listing} />
          <InterestInbox />
        </>
      )}
    </div>
  );
}

/* ------------------------------ step one ------------------------------- */

/** What the public interest form already captured, if this founder used it. */
type SignupDraft = FunctionReturnType<typeof api.users.mySignupDraft>;

/**
 * Prefills a field only when the earlier text still fits the field it is going
 * into. Truncating would put words in a founder's mouth that they never wrote
 * and cannot see they are missing — an empty field they fill deliberately is
 * better than a sentence silently cut in half.
 */
function withinLimit(value: string | undefined, max: number) {
  const text = (value ?? "").trim();
  return text.length > 0 && text.length <= max ? text : undefined;
}


function OrganizationSummary({ name, slug }: { name: string; slug: string }) {
  return (
    <Section
      step="STEP 1 / ORGANIZATION"
      title={name}
      intro={
        <>
          Your workspace, at <code>{slug}</code>. Profiles, listings and approvals all belong to it,
          so colleagues you add can review work you did not write.
        </>
      }
    >
      <p className="workspace-done">
        <Check size={14} /> Organization created.
      </p>
    </Section>
  );
}

function CreateOrganization({ draft }: { draft: SignupDraft }) {
  const create = useMutation(api.organizations.create);
  const [name, setName] = useState(draft?.organizationName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugify(name);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await create({ name: name.trim(), slug });
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <Section
      step="STEP 1 / ORGANIZATION"
      title="Create your organization"
      intro="Everything else belongs to an organization — your profile, your listing, and the colleagues you invite to review it."
    >
      <form className="workspace-form" onSubmit={onSubmit}>
        <label>
          Organization name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={120}
            placeholder="Kigali Agritech Cooperative"
          />
          <small>
            {slug ? (
              <>
                Workspace address: <code>{slug}</code>
              </>
            ) : (
              "Used to build your workspace address."
            )}
          </small>
        </label>

        {error && (
          <p className="auth-error" role="alert">
            <AlertTriangle size={15} /> {error}
          </p>
        )}

        <button className="button button-dark" type="submit" disabled={pending || slug.length < 2}>
          {pending ? <Loader2 size={15} className="spin" /> : <Building2 size={15} />}
          {pending ? "Creating" : "Create organization"}
        </button>
      </form>
    </Section>
  );
}

/* ------------------------------ step two ------------------------------- */

function CreateProfile({ organizationId, draft }: { organizationId: string; draft: SignupDraft }) {
  const create = useMutation(api.profiles.create);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      organizationId: organizationId as Parameters<typeof create>[0]["organizationId"],
      name: String(form.get("name") ?? ""),
      organizationType: String(form.get("organizationType") ?? "startup") as StartupProfile["organizationType"],
      website: String(form.get("website") ?? ""),
      location: String(form.get("location") ?? ""),
      region: String(form.get("region") ?? "") as StartupProfile["region"],
      stage: String(form.get("stage") ?? "") as StartupProfile["stage"],
      // Comma-separated in the UI because a tag editor is a lot of machinery
      // for a field that is edited roughly once.
      sectors: String(form.get("sectors") ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      raiseAmountUsd: Number(form.get("raiseAmountUsd") ?? 0),
      oneLiner: String(form.get("oneLiner") ?? ""),
      traction: String(form.get("traction") ?? ""),
      impact: String(form.get("impact") ?? ""),
      founderContext: String(form.get("founderContext") ?? ""),
      targetRegions: capitalRegions.filter((region) => form.get(`target-${region}`) === "on"),
      consentToProcess: form.get("consentToProcess") === "on",
    };

    try {
      await create(payload);
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <Section
      step="STEP 2 / PROFILE"
      title="Describe what you are building"
      intro={
        draft ? (
          <>
            Started from what you wrote on the interest form — check every field and change
            anything that has moved on. These are the only facts the platform will ever use about
            you; a draft or a listing can never state something that is not here.
          </>
        ) : (
          <>
            These are the only facts the platform will ever use about you. A draft or a listing can
            never state something that is not here.
          </>
        )
      }
    >
      <form className="workspace-form" onSubmit={onSubmit}>
        <label>
          Company or organization name
          <input
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            defaultValue={withinLimit(draft?.organizationName, 100)}
          />
        </label>

        <label>
          Type
          <select name="organizationType" defaultValue="startup">
            {organizationTypes.map((type) => (
              <option key={type} value={type}>
                {type === "startup" ? "Startup" : "Institution or cooperative"}
              </option>
            ))}
          </select>
        </label>

        <label>
          Website
          <input
            name="website"
            type="url"
            required
            placeholder="https://example.com"
            defaultValue={draft?.website || undefined}
          />
        </label>

        <div className="workspace-row">
          <label>
            Where are you based?
            <input
              name="location"
              type="text"
              required
              minLength={2}
              maxLength={120}
              defaultValue={withinLimit(draft?.location, 120)}
            />
          </label>
          <label>
            Region
            <select name="region" defaultValue={regions[0]} required>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="workspace-row">
          <label>
            Stage
            <select name="stage" defaultValue={draft?.stage || "seed"} required>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label>
            Raising (USD)
            <input name="raiseAmountUsd" type="number" min={1} step={1000} required defaultValue={500000} />
          </label>
        </div>

        <label>
          Sectors
          <input name="sectors" type="text" required placeholder="agritech, logistics" />
          <small>Up to five, separated by commas.</small>
        </label>

        <label>
          One line
          <input
            name="oneLiner"
            type="text"
            required
            minLength={20}
            maxLength={240}
            defaultValue={withinLimit(draft?.oneLiner, 240)}
          />
          <small>At least 20 characters. What you do, in a sentence an investor can repeat.</small>
        </label>

        <label>
          Traction
          <textarea name="traction" required minLength={20} maxLength={1200} rows={4} />
          <small>Numbers where you have them. This is what a listing is allowed to claim.</small>
        </label>

        <label>
          Impact
          <textarea name="impact" required minLength={20} maxLength={1200} rows={4} />
        </label>

        <label>
          Founder context
          <textarea
            name="founderContext"
            required
            minLength={20}
            maxLength={1600}
            rows={4}
            defaultValue={withinLimit(draft?.founderContext, 1600)}
          />
          <small>Why you, and what an investor unfamiliar with your market should understand.</small>
        </label>

        <fieldset className="auth-roles">
          <legend>Where is the capital you are looking for?</legend>
          {capitalRegions.map((region) => (
            <label key={region}>
              <input
                type="checkbox"
                name={`target-${region}`}
                defaultChecked={
                  draft?.targetRegions.length
                    ? draft.targetRegions.includes(region)
                    : region === "US"
                }
              />
              {region}
            </label>
          ))}
        </fieldset>

        <label className="workspace-consent">
          <input type="checkbox" name="consentToProcess" required />
          I confirm these details are accurate and consent to them being processed for matching and,
          if I later publish a listing, shown to investors.
        </label>

        {error && (
          <p className="auth-error" role="alert">
            <AlertTriangle size={15} /> {error}
          </p>
        )}

        <button className="button button-dark" type="submit" disabled={pending}>
          {pending ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
          {pending ? "Saving" : "Save profile"}
        </button>
      </form>
    </Section>
  );
}

/* ----------------------------- step three ------------------------------ */

const VISIBILITY_COPY = {
  private: {
    label: "Private draft",
    body: "Only your organization can see this. Submit it when you are ready for review.",
  },
  review: {
    label: "Awaiting review",
    body: "An operator is checking this listing. You can withdraw it at any time.",
  },
  listed: {
    label: "Published",
    body: "Investors browsing the catalogue can see this. Take it down whenever you want.",
  },
} as const;

/* Derived from the query itself rather than restated by hand, so a change to
   what `myListing` returns is a type error here instead of a silent drift. */
function useMyListing() {
  return useQuery(api.catalogue.myListing);
}
type MyListing = NonNullable<ReturnType<typeof useMyListing>>;

function ListingEditor({ listing: data }: { listing: MyListing }) {
  const save = useMutation(api.catalogue.saveListing);
  const submit = useMutation(api.catalogue.submitForReview);
  const withdraw = useMutation(api.catalogue.withdraw);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = data.listing;
  const visibility = current?.visibility ?? "private";
  const copy = VISIBILITY_COPY[visibility];

  async function run(action: string, task: () => Promise<unknown>) {
    setPending(action);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(null);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = (key: string) =>
      String(form.get(key) ?? "")
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean);

    await run("save", () =>
      save({
        startupProfileId: data.startupProfileId as Parameters<typeof save>[0]["startupProfileId"],
        publicContext: String(form.get("publicContext") ?? ""),
        publicTraction: String(form.get("publicTraction") ?? ""),
        publicStrengths: lines("publicStrengths"),
        publicConsiderations: lines("publicConsiderations"),
      }),
    );
  }

  return (
    <Section
      step="STEP 3 / LISTING"
      title="What investors will read"
      intro={
        <>
          Written separately from your profile on purpose: this is the public half, and you decide
          every word of it. Your private intake record is never shown here.
        </>
      }
    >
      <p className={`workspace-status workspace-status-${visibility}`}>
        <Eye size={14} /> <strong>{copy.label}.</strong> {copy.body}
      </p>

      <form className="workspace-form" onSubmit={onSave}>
        <label>
          Operating context
          <textarea
            name="publicContext"
            required
            rows={4}
            maxLength={2000}
            defaultValue={current?.publicContext ?? ""}
          />
          <small>The market and conditions you operate in, for a reader who does not know them.</small>
        </label>

        <label>
          Strengths
          <textarea
            name="publicStrengths"
            rows={4}
            defaultValue={(current?.publicStrengths ?? []).join("\n")}
          />
          <small>One per line, up to eight.</small>
        </label>

        <label>
          Open questions
          <textarea
            name="publicConsiderations"
            rows={4}
            defaultValue={(current?.publicConsiderations ?? []).join("\n")}
          />
          <small>
            One per line. Naming your own risks is what makes the rest of the listing credible.
          </small>
        </label>

        <label>
          Traction, as you want it published
          <textarea
            name="publicTraction"
            rows={3}
            maxLength={2000}
            defaultValue={current?.publicTraction ?? ""}
          />
        </label>

        {visibility === "listed" && (
          <p className="workspace-note">
            This listing is live. Saving an edit takes it down and returns it to review, so a change
            is never published without being seen.
          </p>
        )}

        {error && (
          <p className="auth-error" role="alert">
            <AlertTriangle size={15} /> {error}
          </p>
        )}

        <div className="workspace-actions">
          <button className="button button-dark" type="submit" disabled={pending !== null}>
            {pending === "save" ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            Save draft
          </button>

          {current && visibility === "private" && (
            <button
              className="button"
              type="button"
              disabled={pending !== null}
              onClick={() =>
                run("submit", () =>
                  submit({ listingId: current.id as Parameters<typeof submit>[0]["listingId"] }),
                )
              }
            >
              {pending === "submit" ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              Submit for review
            </button>
          )}

          {current && visibility !== "private" && (
            <button
              className="button"
              type="button"
              disabled={pending !== null}
              onClick={() =>
                run("withdraw", () =>
                  withdraw({ listingId: current.id as Parameters<typeof withdraw>[0]["listingId"] }),
                )
              }
            >
              {pending === "withdraw" ? <Loader2 size={15} className="spin" /> : <Undo2 size={15} />}
              Take it down
            </button>
          )}
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------ step four ------------------------------ */

function InterestInbox() {
  const interests = useQuery(api.catalogue.myListingInterests);
  const respond = useMutation(api.catalogue.respondToInterest);
  const [pending, setPending] = useState<string | null>(null);

  if (interests === undefined) {
    return (
      <Section step="STEP 4 / INTEREST" title="Who has been in touch" intro="Loading…">
        <p className="dashboard-loading">Loading interest…</p>
      </Section>
    );
  }

  return (
    <Section
      step="STEP 4 / INTEREST"
      title="Who has been in touch"
      intro="Investors who saw your published listing and said so. Accepting one shares your contact details with them; declining is silent."
    >
      {interests.length === 0 ? (
        <p className="workspace-empty">
          <Inbox size={15} /> No interest yet. This fills in once your listing is published and an
          investor responds to it — it is never seeded with examples.
        </p>
      ) : (
        <ul className="workspace-inbox">
          {interests.map((interest) => (
            <li key={interest.id}>
              <div>
                <strong>{interest.investorName ?? "An investor"}</strong>
                {interest.investorOrganization && <span> · {interest.investorOrganization}</span>}
                {interest.investorType && <span className="workspace-tag">{interest.investorType}</span>}
                <time dateTime={new Date(interest.createdAt).toISOString()}>
                  {new Date(interest.createdAt).toLocaleDateString()}
                </time>
              </div>

              {interest.note && <p className="workspace-note-text">“{interest.note}”</p>}

              {interest.status === "submitted" ? (
                <div className="workspace-actions">
                  <button
                    className="button button-dark"
                    type="button"
                    disabled={pending !== null}
                    onClick={async () => {
                      setPending(interest.id);
                      try {
                        await respond({ interestId: interest.id, accept: true });
                      } finally {
                        setPending(null);
                      }
                    }}
                  >
                    {pending === interest.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    Accept
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={pending !== null}
                    onClick={async () => {
                      setPending(interest.id);
                      try {
                        await respond({ interestId: interest.id, accept: false });
                      } finally {
                        setPending(null);
                      }
                    }}
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p className="workspace-note-text">
                  {interest.status === "accepted" ? (
                    <>
                      Accepted. Reach them at{" "}
                      <a href={`mailto:${interest.investorEmail ?? ""}`}>{interest.investorEmail}</a>.
                    </>
                  ) : (
                    "Declined."
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
