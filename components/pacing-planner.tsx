"use client";

import { useMemo, useState } from "react";
import { computePortfolioPacing, DEFAULT_PACING_RATES } from "@/lib/portfolio-math";
import { AnimatedNumber } from "@/components/animated-number";

export function PacingPlanner() {
  const [targetInvestmentsPerYear, setTargetInvestmentsPerYear] = useState(6);
  const [reviewToMeetingPct, setReviewToMeetingPct] = useState(DEFAULT_PACING_RATES.reviewToMeetingRate * 100);
  const [meetingToInvestPct, setMeetingToInvestPct] = useState(DEFAULT_PACING_RATES.meetingToInvestRate * 100);
  const [activeWeeksPerYear, setActiveWeeksPerYear] = useState<number>(DEFAULT_PACING_RATES.activeWeeksPerYear);

  const result = useMemo(
    () =>
      computePortfolioPacing({
        targetInvestmentsPerYear,
        reviewToMeetingRate: reviewToMeetingPct / 100,
        meetingToInvestRate: meetingToInvestPct / 100,
        activeWeeksPerYear,
      }),
    [targetInvestmentsPerYear, reviewToMeetingPct, meetingToInvestPct, activeWeeksPerYear],
  );

  return (
    <div className="calc-grid">
      <form className="apply-form" onSubmit={(event) => event.preventDefault()}>
        <div className="form-heading">
          <span>YOUR PORTFOLIO</span>
          <h2>Set your targets</h2>
          <p>Every default below is an editable planning assumption, not a measured outcome.</p>
        </div>

        <label>
          Target investments per year
          <input
            type="number"
            min={0}
            step={1}
            value={targetInvestmentsPerYear}
            onChange={(event) => setTargetInvestmentsPerYear(Math.max(0, Number(event.target.value) || 0))}
          />
        </label>

        <div className="form-row">
          <label>
            Company review → meeting rate (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={reviewToMeetingPct}
              onChange={(event) => setReviewToMeetingPct(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
            />
          </label>
          <label>
            Meeting → investment rate (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={meetingToInvestPct}
              onChange={(event) => setMeetingToInvestPct(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
            />
          </label>
        </div>

        <label>
          Active sourcing weeks per year
          <input
            type="number"
            min={1}
            max={52}
            step={1}
            value={activeWeeksPerYear}
            onChange={(event) => setActiveWeeksPerYear(Math.min(52, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
        <p className="calc-field-note">Accounts for time off diligence, travel, and holidays — 52 assumes no downtime at all.</p>
      </form>

      <div className="calc-panel" aria-live="polite">
        <h2>YOUR PIPELINE, RUN BACKWARD FROM THE GOAL</h2>
        <div className="signal-stats">
          <article>
            <strong><AnimatedNumber value={targetInvestmentsPerYear} /></strong>
            <span>INVESTMENTS TARGETED</span>
          </article>
          <article>
            <strong><AnimatedNumber value={result.meetingsNeeded} /></strong>
            <span>MEETINGS NEEDED</span>
          </article>
          <article>
            <strong><AnimatedNumber value={result.companiesToReviewNeeded} /></strong>
            <span>COMPANIES TO REVIEW</span>
          </article>
          <article>
            <strong>{result.reviewsPerWeek}</strong>
            <span>REVIEWS NEEDED PER WEEK</span>
          </article>
        </div>
        <p className="calc-note">
          That is roughly {result.meetingsPerWeek} meetings a week and {result.reviewsPerWeek} new companies reviewed a week to stay on
          pace — if these conversion rates hold.
        </p>
        <p className="calc-note">
          This is a planning model, not a guarantee. It exists so &ldquo;see more deal flow&rdquo; turns into a specific weekly number instead of a
          vague goal.
        </p>
      </div>
    </div>
  );
}
