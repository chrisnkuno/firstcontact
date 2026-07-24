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
import { T, useTranslation } from "@/components/translation-provider";
import { normalizeSignupWebsite } from "@/lib/domain";

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

const fieldToStep: Record<string, 1 | 2 | 3> = {
  accountType: 1,
  name: 1,
  email: 1,
  location: 1,
  organizationName: 1,
  individualRole: 1,
  website: 2,
  stage: 2,
  summary: 2,
  context: 2,
  goals: 3,
  targetRegions: 3,
  referralSource: 3,
  consentToProcess: 3,
};

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
  const { translate: t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{
    reference: string;
    created: boolean;
  } | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
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

  // Mirrors lib/domain.ts's trimmed-length rules so a field that merely looks
  // long enough on screen (e.g. padded with trailing spaces) is caught here,
  // in context, instead of failing silently after the network round trip.
  function validateStep(current: number): { field: string; message: string } | null {
    if (current === 1) {
      if (form.name.trim().length < 2) return { field: "name", message: "Add your name." };
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return { field: "email", message: "Add a valid email address." };
      if (form.location.trim().length < 2) return { field: "location", message: "Add your location." };
      if (form.accountType === "individual" && !form.individualRole) {
        return { field: "individualRole", message: "Choose the role that best describes you." };
      }
      if (form.accountType !== "individual" && !form.organizationName.trim()) {
        return { field: "organizationName", message: `Add your ${form.accountType === "startup" ? "company" : "institution"} name.` };
      }
    }

    if (current === 2) {
      if (form.summary.trim().length < 20) {
        return { field: "summary", message: "Add a little more detail to the summary (20 characters minimum)." };
      }
      if (form.context.trim().length < 20) {
        return { field: "context", message: "Add a little more detail to the context field (20 characters minimum)." };
      }
    }

    if (current === 3) {
      if (!form.goals.length) {
        return { field: "goals", message: "Choose at least one way you would like to use FirstContact." };
      }
      if (!form.consentToProcess) {
        return { field: "consentToProcess", message: "Please confirm consent to store your signup information." };
      }
    }

    return null;
  }

  function continueTo(nextStep: number) {
    const issue = validateStep(step);
    if (issue) {
      setError(issue.message);
      setFieldErrors({ [issue.field]: [issue.message] });
      return;
    }
    setError("");
    setStep(nextStep);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    for (const candidateStep of [1, 2, 3]) {
      const issue = validateStep(candidateStep);
      if (issue) {
        setStep(candidateStep);
        setError(issue.message);
        setFieldErrors({ [issue.field]: [issue.message] });
        window.setTimeout(() => {
          formRef.current
            ?.querySelector<HTMLElement>(`[name="${issue.field}"]`)
            ?.focus();
        });
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setFieldErrors({});
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const website = normalizeSignupWebsite(form.website);
      const response = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...form,
          organizationName:
            form.accountType === "individual"
              ? form.organizationName || undefined
              : form.organizationName,
          website,
          individualRole:
            form.accountType === "individual"
              ? form.individualRole
              : undefined,
          stage: form.accountType === "startup" ? form.stage : undefined,
        }),
      });
      const responseBody = await response.text();
      let payload: {
        ok: boolean;
        message?: string;
        reference?: string;
        created?: boolean;
        fields?: Record<string, string[] | undefined>;
      };
      try {
        payload = JSON.parse(responseBody) as typeof payload;
      } catch {
        throw new Error(
          response.ok
            ? "The signup response could not be confirmed. Please try again."
            : "The signup service is temporarily unavailable. Please try again shortly.",
        );
      }
      if (!payload || typeof payload !== "object") {
        throw new Error("The signup response could not be confirmed. Please try again.");
      }

      if (!response.ok || !payload.ok || !payload.reference) {
        const erroredFields = Object.keys(payload.fields ?? {}).filter(
          (key) => payload.fields?.[key]?.length,
        );
        if (erroredFields.length) {
          setFieldErrors(
            Object.fromEntries(
              erroredFields.map((key) => [key, payload.fields?.[key] ?? []]),
            ),
          );
          const earliestStep = erroredFields.reduce(
            (min, key) => Math.min(min, fieldToStep[key] ?? 3),
            3,
          );
          setStep(earliestStep);
        }
        throw new Error(payload.message || "Your signup could not be saved.");
      }

      setResult({
        reference: payload.reference,
        created: payload.created ?? true,
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof DOMException && submissionError.name === "AbortError"
          ? "Saving is taking longer than expected. Please check your connection and try again; a repeat submission will update the same record."
          : submissionError instanceof Error
          ? submissionError.message
          : "Your signup could not be saved.",
      );
    } finally {
      window.clearTimeout(timeout);
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
          <T>{result.created ? "You are on the map." : "Your context is updated."}</T>
        </h2>
        <p>
          <T>
            {individual
              ? "We saved your interests and how you would like to participate. As access opens, we will use this context to place you in the right FirstContact flow."
              : "We saved your profile and capital-access context. You remain in control of what becomes public and no investor outreach will be sent without review."}
          </T>
        </p>
        <div className="success-next">
          <Link className="button button-dark" href={individual ? "/catalogue" : "/workspace"}>
            <T>{individual ? "Explore the catalogue" : "Explore the workspace"}</T>
            <ArrowRight size={17} />
          </Link>
          <Link className="text-link" href="/">
            <T>Return home</T>
          </Link>
        </div>
        <small>
          <T>Keep reference</T> <b>{result.reference}</b> <T>for future access questions.</T>
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

      {error && (
        <div className="form-error" role="alert">
          <T>{error}</T>
        </div>
      )}

      {step === 1 && (
        <section className="signup-step">
          <div className="form-heading">
            <span>STEP 01 / THREE MINUTES</span>
            <h2><T>How will you use FirstContact?</T></h2>
            <p><T>Choose the closest fit. You can update this context later.</T></p>
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
                <b><T>{label}</T></b>
                <small><T>{description}</T></small>
              </label>
            ))}
          </div>

          <div className="form-row">
            <label>
              <T>Your name</T>
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.name)}
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="name"
                placeholder={t("Full name")}
              />
            </label>
            <label>
              <T>Work email</T>
              <input
                name="email"
                required
                type="email"
                maxLength={254}
                aria-invalid={Boolean(fieldErrors.email)}
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
                placeholder="you@organization.org"
              />
            </label>
          </div>
          <p className="field-hint">
            <T>Why we ask: your email identifies your signup so a repeat submission updates your existing record instead of creating a duplicate. It is never sold or shared.</T>
          </p>

          <div className="form-row">
            <label>
              <T>Location</T>
              <input
                name="location"
                required
                minLength={2}
                maxLength={120}
                aria-invalid={Boolean(fieldErrors.location)}
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
                autoComplete="country-name"
                placeholder={t("City, country")}
              />
            </label>
            {form.accountType === "individual" ? (
              <label>
                <T>Your primary role</T>
                <select
                  name="individualRole"
                  required
                  aria-invalid={Boolean(fieldErrors.individualRole)}
                  value={form.individualRole}
                  onChange={(event) =>
                    update("individualRole", event.target.value)
                  }
                >
                  <option value="">{t("Choose one")}</option>
                  <option value="founder">{t("Founder")}</option>
                  <option value="investor">{t("Investor")}</option>
                  <option value="operator">{t("Operator")}</option>
                  <option value="advisor">{t("Advisor / mentor")}</option>
                  <option value="researcher">{t("Researcher")}</option>
                  <option value="other">{t("Other")}</option>
                </select>
              </label>
            ) : (
              <label>
                <T>Organization name</T>
                <input
                  name="organizationName"
                  required
                  minLength={2}
                  maxLength={120}
                  aria-invalid={Boolean(fieldErrors.organizationName)}
                  value={form.organizationName}
                  onChange={(event) =>
                    update("organizationName", event.target.value)
                  }
                  autoComplete="organization"
                  placeholder={t(
                    form.accountType === "startup"
                      ? "Company name"
                      : "Institution name",
                  )}
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
              <T>Continue</T> <ArrowRight size={17} />
            </button>
            <small><T>1 of 3 · no pitch deck needed</T></small>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="signup-step">
          <div className="form-heading">
            <span>STEP 02 / YOUR CONTEXT</span>
            <h2><T>What should the network understand?</T></h2>
            <p><T>Plain language is useful. Share only what you are comfortable processing.</T></p>
          </div>

          <div className="form-row">
            <label>
              <T>Website</T> <small>OPTIONAL</small>
              <input
                name="website"
                type="text"
                inputMode="url"
                maxLength={2048}
                aria-invalid={Boolean(fieldErrors.website)}
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
                onBlur={() => {
                  const website = normalizeSignupWebsite(form.website);
                  if (website) update("website", website);
                }}
                autoComplete="url"
                placeholder="https://"
              />
            </label>
            {form.accountType === "startup" ? (
              <label>
                <T>Current stage</T>
                <select
                  name="stage"
                  value={form.stage}
                  onChange={(event) => update("stage", event.target.value)}
                >
                  <option value="pre-seed">{t("Pre-seed")}</option>
                  <option value="seed">{t("Seed")}</option>
                  <option value="series-a">{t("Series A")}</option>
                  <option value="series-b+">{t("Series B+")}</option>
                  <option value="growth">{t("Growth")}</option>
                </select>
              </label>
            ) : (
              <label>
                <T>Organization</T> <small>OPTIONAL</small>
                <input
                  name="organizationName"
                  maxLength={120}
                  value={form.organizationName}
                  onChange={(event) =>
                    update("organizationName", event.target.value)
                  }
                  autoComplete="organization"
                  placeholder={t("Where you work or participate")}
                />
              </label>
            )}
          </div>

          <label>
            <T>
              {form.accountType === "individual"
                ? "What are you working on or looking for?"
                : "What are you building or enabling?"}
            </T>
            <textarea
              name="summary"
              required
              minLength={20}
              maxLength={700}
              rows={4}
              value={form.summary}
              aria-invalid={Boolean(fieldErrors.summary)}
              onChange={(event) => update("summary", event.target.value)}
              placeholder={t("A short, concrete description in your own words.")}
            />
            <small>{form.summary.length}/700</small>
          </label>

          <label>
            <T>What context would someone outside your ecosystem miss?</T>
            <textarea
              name="context"
              required
              minLength={20}
              maxLength={1200}
              rows={5}
              value={form.context}
              aria-invalid={Boolean(fieldErrors.context)}
              onChange={(event) => update("context", event.target.value)}
              placeholder={t("Local market realities, expertise, constraints, access, or opportunities that change the picture.")}
            />
            <small>{form.context.length}/1200</small>
          </label>

          <div className="form-actions">
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={16} /> <T>Back</T>
            </button>
            <button
              className="button button-accent"
              type="button"
              onClick={() => continueTo(3)}
            >
              <T>Continue</T> <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="signup-step">
          <div className="form-heading">
            <span>STEP 03 / YOUR INTEREST</span>
            <h2><T>What would make this useful?</T></h2>
            <p><T>Your selections help us prioritise access and route relevant opportunities.</T></p>
          </div>

          <fieldset className="choice-fieldset">
            <legend><T>What would you like to do?</T></legend>
            <div className="choice-grid">
              {goals.map(([value, label]) => (
                <label
                  className={form.goals.includes(value) ? "selected" : ""}
                  key={value}
                >
                  <input
                    name="goals"
                    type="checkbox"
                    checked={form.goals.includes(value)}
                    onChange={() => toggleList("goals", value)}
                  />
                  <span><T>{label}</T></span>
                  <Check size={14} />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-fieldset">
            <legend><T>Capital regions of interest</T></legend>
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
            <T>How did you find FirstContact?</T>
            <select
              value={form.referralSource}
              onChange={(event) =>
                update("referralSource", event.target.value)
              }
            >
              <option value="search">{t("Search")}</option>
              <option value="social">{t("Social media")}</option>
              <option value="community">{t("Founder / investor community")}</option>
              <option value="referral">{t("Personal referral")}</option>
              <option value="event">{t("Event")}</option>
              <option value="other">{t("Other")}</option>
            </select>
          </label>

          <div className="consent-stack">
            <label className="consent">
              <input
                name="consentToProcess"
                required
                type="checkbox"
                aria-invalid={Boolean(fieldErrors.consentToProcess)}
                checked={form.consentToProcess}
                onChange={(event) =>
                  update("consentToProcess", event.target.checked)
                }
              />
              <span>
                <T>I consent to FirstContact storing this information to manage my signup and relevant participation.</T>
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
              <span><T>Send me occasional product and access updates.</T></span>
            </label>
          </div>

          <div className="process-steps">
            <span>WHAT HAPPENS AFTER YOU SUBMIT</span>
            <ol>
              <li><b>01</b> <T>We save this as a private interest record, matched to your email so repeat visits update it rather than duplicate it.</T></li>
              <li><b>02</b> <T>A person reviews it. Nothing here creates a live catalogue listing, investor match, or outbound message on its own.</T></li>
              <li><b>03</b> <T>{form.productUpdates ? "Since you opted in, we'll email you as relevant access opens." : "We'll hold your context until access opens for your kind of profile."}</T></li>
            </ol>
          </div>

          <label className="signup-honeypot" aria-hidden="true">
            Leave this field empty
            <input
              tabIndex={-1}
              autoComplete="off"
              name="a11y-check"
              data-lpignore="true"
              data-1p-ignore="true"
              value={form.company}
              onChange={(event) => update("company", event.target.value)}
            />
          </label>

          <div className="form-actions">
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={16} /> <T>Back</T>
            </button>
            <button
              className="button button-accent"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="spin" size={17} /> <T>Saving</T>
                </>
              ) : (
                <>
                  <T>Join FirstContact</T> <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
          <p className="submission-note">
            <T>Private by default. No catalogue listing or investor outreach is created from this signup.</T>
          </p>
        </section>
      )}
    </form>
  );
}
