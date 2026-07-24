"use client";

import { useMemo, useState } from "react";
import { stages } from "@/lib/domain";
import {
  computeFounderFunnel,
  DEFAULT_FUNNEL_RATES,
  defaultAvgCheckForStage,
  STAGE_AVG_CHECK_USD,
  type Stage,
} from "@/lib/outreach-math";
import { AnimatedNumber } from "@/components/animated-number";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

const stageLabels: Record<Stage, string> = {
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b+": "Series B+",
  growth: "Growth",
  institutional: "Institutional",
};

export function FunnelPlanner() {
  const [stage, setStage] = useState<Stage>("seed");
  const [raiseAmountUsd, setRaiseAmountUsd] = useState(500_000);
  const [avgCheckUsd, setAvgCheckUsd] = useState(STAGE_AVG_CHECK_USD.seed);
  const [contactToReplyPct, setContactToReplyPct] = useState(DEFAULT_FUNNEL_RATES.contactToReplyRate * 100);
  const [replyToMeetingPct, setReplyToMeetingPct] = useState(DEFAULT_FUNNEL_RATES.replyToMeetingRate * 100);
  const [meetingToCommitPct, setMeetingToCommitPct] = useState(DEFAULT_FUNNEL_RATES.meetingToCommitRate * 100);
  const [weeklyContactCapacity, setWeeklyContactCapacity] = useState<number>(DEFAULT_FUNNEL_RATES.weeklyContactCapacity);

  const result = useMemo(
    () =>
      computeFounderFunnel({
        raiseAmountUsd,
        avgCheckUsd,
        contactToReplyRate: contactToReplyPct / 100,
        replyToMeetingRate: replyToMeetingPct / 100,
        meetingToCommitRate: meetingToCommitPct / 100,
        weeklyContactCapacity,
      }),
    [raiseAmountUsd, avgCheckUsd, contactToReplyPct, replyToMeetingPct, meetingToCommitPct, weeklyContactCapacity],
  );

  function handleStageChange(nextStage: Stage) {
    setStage(nextStage);
    setAvgCheckUsd(defaultAvgCheckForStage(nextStage));
  }

  return (
    <div className="calc-grid">
      <form className="apply-form" onSubmit={(event) => event.preventDefault()}>
        <div className="form-heading">
          <span>YOUR RAISE</span>
          <h2>Set your targets</h2>
          <p>Every default below is an editable planning assumption, not a measured outcome.</p>
        </div>

        <div className="form-row">
          <label>
            Raise amount
            <input
              type="number"
              min={0}
              step={10_000}
              value={raiseAmountUsd}
              onChange={(event) => setRaiseAmountUsd(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <label>
            Stage
            <select value={stage} onChange={(event) => handleStageChange(event.target.value as Stage)}>
              {stages.map((value) => (
                <option key={value} value={value}>
                  {stageLabels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Average check size
          <input
            type="number"
            min={1}
            step={1_000}
            value={avgCheckUsd}
            onChange={(event) => setAvgCheckUsd(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <p className="calc-field-note">
          Defaulted from a typical {stageLabels[stage].toLowerCase()} check size. Adjust it to what you actually see from the firms you target.
        </p>

        <div className="form-row">
          <label>
            Cold contact → reply rate (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={contactToReplyPct}
              onChange={(event) => setContactToReplyPct(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
            />
          </label>
          <label>
            Reply → meeting rate (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={replyToMeetingPct}
              onChange={(event) => setReplyToMeetingPct(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Meeting → commit rate (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={meetingToCommitPct}
              onChange={(event) => setMeetingToCommitPct(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
            />
          </label>
          <label>
            Contacts you can send per week
            <input
              type="number"
              min={0}
              step={1}
              value={weeklyContactCapacity}
              onChange={(event) => setWeeklyContactCapacity(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
        </div>
      </form>

      <div className="calc-panel" aria-live="polite">
        <h2>YOUR FUNNEL, RUN BACKWARD FROM THE GOAL</h2>
        <div className="signal-stats">
          <article>
            <strong><AnimatedNumber value={result.investorsNeeded} /></strong>
            <span>INVESTORS TO CLOSE {usd.format(raiseAmountUsd)}</span>
          </article>
          <article>
            <strong><AnimatedNumber value={result.meetingsNeeded} /></strong>
            <span>MEETINGS NEEDED</span>
          </article>
          <article>
            <strong><AnimatedNumber value={result.repliesNeeded} /></strong>
            <span>REPLIES NEEDED</span>
          </article>
          <article>
            <strong><AnimatedNumber value={result.contactsNeeded} /></strong>
            <span>CONTACTS NEEDED</span>
          </article>
        </div>
        <p className="calc-note">
          {result.weeksToClose !== null
            ? `At ${number.format(weeklyContactCapacity)} contacts a week, that is roughly ${number.format(result.weeksToClose)} weeks of consistent outreach — if these conversion rates hold.`
            : "Set a weekly contact capacity above 0 to see a timeline."}
        </p>
        <p className="calc-note">
          This is a planning model, not a guarantee. It exists so &ldquo;send more&rdquo; turns into a specific weekly number instead of a vague goal.
        </p>
      </div>
    </div>
  );
}
