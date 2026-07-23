"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleUserRound,
  Landmark,
  LoaderCircle,
} from "lucide-react";

const accountTypes = [
  {
    value: "startup",
    label: "Startup",
    description: "Build an investor pipeline and share your company context.",
    icon: Building2,
  },
  {
    value: "institution",
    label: "Institution",
    description: "Represent a fundable programme, lab, or ecosystem initiative.",
    icon: Landmark,
  },
  {
    value: "individual",
    label: "Individual",
    description: "Join as an investor, founder, operator, advisor, or researcher.",
    icon: CircleUserRound,
  },
] as const;

const goals = [
  ["raise-capital", "Raise capital"],
  ["find-investors", "Find aligned investors"],
  ["join-catalogue", "Join the curated catalogue"],
  ["invest", "Discover opportunities"],
  ["mentor", "Mentor founders"],
  ["partner", "Explore partnerships"],
  ["research", "Follow the ecosystem"],
] as const;

type FormState = {
  accountType: "startup" | "institution" | "individual";
  name: string;
  email: string;
  location: string;
  organizationName: string;
  website: string;
  individualRole: string;
  stage: string;
  summary: string;
  context: string;
  goals: string[];
  targetRegions: string[];
  referralSource: string;
  productUpdates: boolean;
  consentToProcess: boolean;
  company: string;
};

const initialState: FormState = {
  accountType: "startup",
  name: "",
  email: "",
  location: "",
  organizationName: "",
  website: "",
  individualRole: "",
  stage: "seed",
  summary: "",
  context: "",
  goals: ["raise-capital", "find-investors"],
  targetRegions: ["US", "UK", "EU", "APAC"],
  referralSource: "search",
  productUpdates: false,
  consentToProcess: false,
  company: "",
};

export function ApplyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    reference: string;
    created: boolean;
  } | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function toggleList(key: "goals" | "targetRegions", value: string) {
    const selected = form[key];
    update(
      key,
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  }

  function continueTo(nextStep: number) {
    if (!formRef.current?.reportValidity()) return;
    setStep(nextStep);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.goals.length) {
      setError("Choose at least one way you would like to use FirstContact.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organizationName:
            form.accountType === "individual"
              ? form.organizationName || undefined
              : form.organizationName,
          website: form.website || undefined,
          individualRole:
            form.accountType === "individual"
              ? form.individualRole
              : undefined,
          stage: form.accountType === "startup" ? form.stage : undefined,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        reference?: string;
        created?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.reference) {
        throw new Error(payload.message || "Your signup could not be saved.");
      }

      setResult({
        reference: payload.reference,
        created: payload.created ?? true,
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your signup could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const individual = form.accountType === "individual";
    return (
      <div className="success-card signup-success" aria-live="polite">
        <CheckCircle2 size={34} />
        <span>SIGNUP RECORDED / {result.reference}</span>
        <h2>
          {result.created ? "You are on the map." : "Your context is updated."}
        </h2>
        <p>
          {individual
            ? "We saved your interests and how you would like to participate. As access opens, we will use this context to place you in the right FirstContact flow."
            : "We saved your profile and capital-access context. You remain in control of what becomes public and no investor outreach will be sent without review."}
        </p>
        <div className="success-next">
          <Link className="button button-dark" href={individual ? "/catalogue" : "/workspace"}>
            {individual ? "Explore the catalogue" : "Explore the workspace"}
            <ArrowRight size={17} />
          </Link>
          <Link className="text-link" href="/">
            Return home
          </Link>
        </div>
        <small>
          Keep reference <b>{result.reference}</b> for future access questions.
        </small>
      </div>
    );
  }

  return (
    <form className="apply-form signup-form" onSubmit={submit} ref={formRef}>
      <div className="signup-progress" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((item) => (
          <span className={item <= step ? "active" : ""} key={item}>
            <i>{item < step ? <Check size={11} /> : `0${item}`}</i>
            {item === 1 ? "YOU" : item === 2 ? "CONTEXT" : "INTEREST"}
          </span>
        ))}
      </div>

      {step === 1 && (
        <section className="signup-step">
          <div className="form-heading">
            <span>STEP 01 / THREE MINUTES</span>
            <h2>How will you use FirstContact?</h2>
            <p>Choose the closest fit. You can update this context later.</p>
          </div>

          <div className="account-type-grid">
            {accountTypes.map(({ value, label, description, icon: Icon }) => (
              <label
                className={form.accountType === value ? "selected" : ""}
                key={value}
              >
                <input
                  type="radio"
                  name="accountType"
                  value={value}
                  checked={form.accountType === value}
                  onChange={() => update("accountType", value)}
                />
                <Icon size={20} />
                <b>{label}</b>
                <small>{description}</small>
              </label>
            ))}
          </div>

          <div className="form-row">
            <label>
              Your name
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="name"
                placeholder="Full name"
              />
            </label>
            <label>
              Work email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
                placeholder="you@organization.org"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Location
              <input
                required
                minLength={2}
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
                autoComplete="country-name"
                placeholder="City, country"
              />
            </label>
            {form.accountType === "individual" ? (
              <label>
                Your primary role
                <select
                  required
                  value={form.individualRole}
                  onChange={(event) =>
                    update("individualRole", event.target.value)
                  }
                >
                  <option value="">Choose one</option>
                  <option value="founder">Founder</option>
                  <option value="investor">Investor</option>
                  <option value="operator">Operator</option>
                  <option value="advisor">Advisor / mentor</option>
                  <option value="researcher">Researcher</option>
                  <option value="other">Other</option>
                </select>
              </label>
            ) : (
              <label>
                Organization name
                <input
                  required
                  minLength={2}
                  value={form.organizationName}
                  onChange={(event) =>
                    update("organizationName", event.target.value)
                  }
                  autoComplete="organization"
                  placeholder={
                    form.accountType === "startup"
                      ? "Company name"
                      : "Institution name"
                  }
                />
              </label>
            )}
          </div>

          <div className="form-actions">
            <button
              className="button button-accent"
              type="button"
              onClick={() => continueTo(2)}
            >
              Continue <ArrowRight size={17} />
            </button>
            <small>1 of 3 · no pitch deck needed</small>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="signup-step">
          <div className="form-heading">
            <span>STEP 02 / YOUR CONTEXT</span>
            <h2>What should the network understand?</h2>
            <p>Plain language is useful. Share only what you are comfortable processing.</p>
          </div>

          <div className="form-row">
            <label>
              Website <small>OPTIONAL</small>
              <input
                type="url"
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
                autoComplete="url"
                placeholder="https://"
              />
            </label>
            {form.accountType === "startup" ? (
              <label>
                Current stage
                <select
                  value={form.stage}
                  onChange={(event) => update("stage", event.target.value)}
                >
                  <option value="pre-seed">Pre-seed</option>
                  <option value="seed">Seed</option>
                  <option value="series-a">Series A</option>
                  <option value="series-b+">Series B+</option>
                  <option value="growth">Growth</option>
                </select>
              </label>
            ) : (
              <label>
                Organization <small>OPTIONAL</small>
                <input
                  value={form.organizationName}
                  onChange={(event) =>
                    update("organizationName", event.target.value)
                  }
                  autoComplete="organization"
                  placeholder="Where you work or participate"
                />
              </label>
            )}
          </div>

          <label>
            {form.accountType === "individual"
              ? "What are you working on or looking for?"
              : "What are you building or enabling?"}
            <textarea
              required
              minLength={20}
              maxLength={700}
              rows={4}
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              placeholder="A short, concrete description in your own words."
            />
            <small>{form.summary.length}/700</small>
          </label>

          <label>
            What context would someone outside your ecosystem miss?
            <textarea
              required
              minLength={20}
              maxLength={1200}
              rows={5}
              value={form.context}
              onChange={(event) => update("context", event.target.value)}
              placeholder="Local market realities, expertise, constraints, access, or opportunities that change the picture."
            />
            <small>{form.context.length}/1200</small>
          </label>

          <div className="form-actions">
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="button button-accent"
              type="button"
              onClick={() => continueTo(3)}
            >
              Continue <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="signup-step">
          <div className="form-heading">
            <span>STEP 03 / YOUR INTEREST</span>
            <h2>What would make this useful?</h2>
            <p>Your selections help us prioritise access and route relevant opportunities.</p>
          </div>

          <fieldset className="choice-fieldset">
            <legend>What would you like to do?</legend>
            <div className="choice-grid">
              {goals.map(([value, label]) => (
                <label
                  className={form.goals.includes(value) ? "selected" : ""}
                  key={value}
                >
                  <input
                    type="checkbox"
                    checked={form.goals.includes(value)}
                    onChange={() => toggleList("goals", value)}
                  />
                  <span>{label}</span>
                  <Check size={14} />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-fieldset">
            <legend>Capital regions of interest</legend>
            <div className="region-choice-grid">
              {["US", "UK", "EU", "APAC"].map((region) => (
                <label
                  className={
                    form.targetRegions.includes(region) ? "selected" : ""
                  }
                  key={region}
                >
                  <input
                    type="checkbox"
                    checked={form.targetRegions.includes(region)}
                    onChange={() => toggleList("targetRegions", region)}
                  />
                  {region}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            How did you find FirstContact?
            <select
              value={form.referralSource}
              onChange={(event) =>
                update("referralSource", event.target.value)
              }
            >
              <option value="search">Search</option>
              <option value="social">Social media</option>
              <option value="community">Founder / investor community</option>
              <option value="referral">Personal referral</option>
              <option value="event">Event</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="consent-stack">
            <label className="consent">
              <input
                required
                type="checkbox"
                checked={form.consentToProcess}
                onChange={(event) =>
                  update("consentToProcess", event.target.checked)
                }
              />
              <span>
                I consent to FirstContact storing this information to manage my
                signup and relevant participation.
              </span>
            </label>
            <label className="consent">
              <input
                type="checkbox"
                checked={form.productUpdates}
                onChange={(event) =>
                  update("productUpdates", event.target.checked)
                }
              />
              <span>Send me occasional product and access updates.</span>
            </label>
          </div>

          <label className="signup-honeypot" aria-hidden="true">
            Company
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.company}
              onChange={(event) => update("company", event.target.value)}
            />
          </label>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="button button-accent"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Saving
                </>
              ) : (
                <>
                  Join FirstContact <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
          <p className="submission-note">
            Private by default. No catalogue listing or investor outreach is
            created from this signup.
          </p>
        </section>
      )}
    </form>
  );
}
