"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function ApplyForm() {
  const [submitted, setSubmitted] = useState(false);
  if (submitted) return <div className="success-card"><CheckCircle2 size={34} /><h2>Profile saved locally.</h2><p>This public preview does not transmit founder data. Connect Convex and authentication to persist submissions in your deployment.</p><a className="button button-dark" href="/workspace">Open the sample workspace <ArrowRight size={17} /></a></div>;
  return (
    <form className="apply-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      <div className="form-row"><label>Organization name<input required minLength={2} name="name" placeholder="e.g. Kivu Grid" /></label><label>Website<input required type="url" name="website" placeholder="https://" /></label></div>
      <div className="form-row"><label>Headquarters<input required name="location" placeholder="City, country" /></label><label>Stage<select name="stage" defaultValue="seed"><option value="pre-seed">Pre-seed</option><option value="seed">Seed</option><option value="series-a">Series A</option><option value="series-b+">Series B+</option><option value="growth">Growth</option><option value="institutional">Institutional</option></select></label></div>
      <label>What are you building?<textarea required minLength={20} name="oneLiner" rows={3} placeholder="A plain-language description of the problem and your approach." /></label>
      <label>What traction should an investor understand?<textarea required minLength={20} name="traction" rows={4} placeholder="Revenue, adoption, outcomes, partnerships, or another verifiable signal." /></label>
      <label>What does local context change?<textarea required minLength={20} name="context" rows={4} placeholder="Explain the market knowledge, operating conditions, or institutional context that a remote investor may miss." /></label>
      <fieldset><legend>Capital regions to research</legend><div className="checks">{["US", "UK", "EU", "APAC"].map((region) => <label key={region}><input type="checkbox" name="regions" value={region} defaultChecked /> {region}</label>)}</div></fieldset>
      <label className="consent"><input required type="checkbox" /> <span>I am authorized to submit this information and consent to its use for investor matching. No outreach is sent without review.</span></label>
      <button className="button button-accent" type="submit">Save and preview pipeline <ArrowRight size={17} /></button>
    </form>
  );
}
