"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, CircleDashed, Info, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { AccountRole } from "@/lib/domain";
import { resolveOnboarding, type OnboardingSignals } from "@/lib/onboarding";

/**
 * The onboarding checklist.
 *
 * Hidden entirely once every step is satisfied, rather than lingering as a
 * congratulatory card — a permanent "you're all set" panel is clutter on a
 * dashboard someone opens daily.
 *
 * Derived steps show a lock-like affordance instead of a button: they cannot be
 * ticked manually because they describe account state, and offering a button
 * that does nothing would be worse than offering none.
 */
export function OnboardingChecklist({
  role,
  signals,
}: {
  role: AccountRole;
  signals: OnboardingSignals;
}) {
  const progress = useQuery(api.onboarding.myProgress);
  const completeStep = useMutation(api.onboarding.completeStep);
  const finish = useMutation(api.onboarding.finish);

  if (progress === undefined) return null;
  if (progress.completedAt !== null) return null;

  const { steps, completedCount, total, allDone } = resolveOnboarding(
    role,
    signals,
    progress.completedSteps,
  );

  return (
    <section className="onboarding-card" aria-labelledby="onboarding-heading">
      <header>
        <div>
          <span>GETTING STARTED</span>
          <h2 id="onboarding-heading">
            {allDone ? "You're set up" : `${completedCount} of ${total} steps done`}
          </h2>
        </div>
        <button
          type="button"
          className="chart-toggle"
          onClick={() => void finish({})}
          title="Hide this checklist"
        >
          <X size={13} /> DISMISS
        </button>
      </header>

      <div
        className="meter-track"
        role="meter"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Onboarding progress"
      >
        <i style={{ width: `${(completedCount / total) * 100}%` }} />
      </div>

      <ol className="onboarding-steps">
        {steps.map((step) => (
          <li key={step.id} data-done={step.done}>
            <i aria-hidden>{step.done ? <Check size={14} /> : <CircleDashed size={14} />}</i>
            <div>
              <b>{step.title}</b>
              <p>{step.body}</p>
              <div className="onboarding-actions">
                {step.action && (
                  <Link className="text-link" href={step.action.href}>
                    {step.action.label} <ArrowRight size={13} />
                  </Link>
                )}
                {!step.done && !step.derived && (
                  <button
                    type="button"
                    className="chart-toggle"
                    onClick={() => void completeStep({ stepId: step.id })}
                  >
                    MARK DONE
                  </button>
                )}
                {step.derived && !step.done && <small>Completes automatically</small>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * A dismissable contextual panel.
 *
 * Used for the one-off explanations that would otherwise become permanent
 * furniture — "what this chart is measuring", "why this is empty". Dismissal is
 * stored per user in Convex rather than in localStorage so it survives a device
 * change, which matters when the explanation is about a safety boundary the
 * user should only have to read once.
 */
export function GuidancePanel({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const progress = useQuery(api.onboarding.myProgress);
  const dismissPanel = useMutation(api.onboarding.dismissPanel);

  if (progress === undefined || progress.dismissedPanels.includes(id)) return null;

  return (
    <aside className="guidance-panel">
      <Info size={16} aria-hidden />
      <div>
        <b>{title}</b>
        {children}
      </div>
      <button
        type="button"
        className="chart-toggle"
        aria-label={`Dismiss ${title}`}
        onClick={() => void dismissPanel({ panelId: id })}
      >
        <X size={13} />
      </button>
    </aside>
  );
}
