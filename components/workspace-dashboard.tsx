"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronRight, CirclePause, Database, Eye, Filter, Gauge, Globe2, Mail, Pause, Play, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { demoEvents, demoMatches } from "@/lib/demo-data";

const filters = ["All", "US", "UK", "EU", "APAC"];

export function WorkspaceDashboard() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(demoMatches[0].id);
  const [showFilters, setShowFilters] = useState(true);
  const [campaignPaused, setCampaignPaused] = useState(true);
  const [drawer, setDrawer] = useState<null | "discovery" | "messages" | "data" | "controls" | "draft">(null);
  const visible = useMemo(() => demoMatches.filter((match) => filter === "All" || match.region === filter), [filter]);
  const current = demoMatches.find((match) => match.id === selected) ?? demoMatches[0];
  return (
    <div className="workspace-layout">
      <aside className="workspace-nav">
        <Link className="workspace-brand" href="/" aria-label="FirstContact home"><i /><span>FC</span></Link>
        <nav><button className="active" title="Pipeline"><Globe2 /></button><button title="Discovery settings" onClick={() => setDrawer("discovery")}><Search /></button><button title="Messages awaiting review" onClick={() => setDrawer("messages")}><Mail /></button><button title="Profile and catalogue data" onClick={() => setDrawer("data")}><Database /></button></nav>
        <button className="avatar" title="Sample account">AK</button>
      </aside>
      <main className="workspace-main" id="main-content">
        <header className="workspace-header"><div><span>FOUNDER CONTROL CENTER / SAMPLE DATA</span><h1>Kivu Grid</h1></div><div className="workspace-head-actions"><Link href="/catalogue">VIEW CATALOGUE <ArrowUpRight size={13} /></Link><button onClick={() => setDrawer("controls")}><SlidersHorizontal size={13} /> OUTREACH CONTROLS</button><div className="mode-badge"><CirclePause size={14} /> PREVIEW — SENDING OFF</div></div></header>
        <section className="metric-grid">
          <article><span>DISCOVERED</span><strong>42</strong><small><i className="green" /> 4 capital regions</small></article>
          <article><span>QUALIFIED</span><strong>18</strong><small><i className="green" /> 43% thesis fit</small></article>
          <article><span>DRAFTED</span><strong>08</strong><small><i className="amber" /> Awaiting review</small></article>
          <article><span>SENT</span><strong>00</strong><small><i /> Live outbound disabled</small></article>
        </section>
        <div className="workspace-columns">
          <section className="matches-panel">
            <div className="panel-title"><div><span>INVESTOR MATCHES</span><small>Source-backed · ranked by fit</small></div><button aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}><Filter size={14} /> FILTER</button></div>
            <AnimatePresence initial={false}>{showFilters && <motion.div className="filter-row" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{filters.map((name) => <button className={filter === name ? "active" : ""} key={name} onClick={() => setFilter(name)}>{name}</button>)}</motion.div>}</AnimatePresence>
            <motion.div layout className="match-list"><AnimatePresence initial={false} mode="popLayout">{visible.map((match) => <motion.button layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .24 }} key={match.id} className={`match-row ${selected === match.id ? "selected" : ""}`} onClick={() => setSelected(match.id)}><span className="score">{match.score}</span><div><strong>{match.firm}</strong><p>{match.thesis}</p><small>{match.region} · {match.stages.join(" / ")}</small></div><ChevronRight size={17} /></motion.button>)}</AnimatePresence></motion.div>
          </section>
          <AnimatePresence initial={false} mode="wait"><motion.aside key={current.id} className="detail-panel" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}>
            <div className="detail-head"><span>MATCH BRIEF</span><a href={current.sourceUrl} target="_blank" rel="noreferrer">SOURCE <ArrowUpRight size={13} /></a></div>
            <h2>{current.firm}</h2><p className="detail-thesis">{current.thesis}</p>
            <div className="score-block"><div><strong>{current.score}</strong><span>/ 100<br />FIT SCORE</span></div><div className="score-bar"><i style={{ width: `${current.score}%` }} /></div></div>
            <div className="evidence"><span>WHY THIS MATCH</span>{current.reasons.map((reason) => <p key={reason}><Check size={14} /> {reason}</p>)}</div>
            {current.risks.length > 0 && <div className="risk"><AlertTriangle size={15} /><p><b>REVIEW NOTE</b>{current.risks.join(". ")}</p></div>}
            <button className="button button-dark full" onClick={() => setDrawer("draft")}><Sparkles size={16} /> Draft introduction</button>
            <p className="action-note"><ShieldCheck size={13} /> Drafting does not send email.</p>
          </motion.aside></AnimatePresence>
        </div>
        <section className="activity-panel"><div className="panel-title"><div><span>PIPELINE ACTIVITY</span><small>Append-only operational history</small></div></div><div className="event-row">{demoEvents.map((event, index) => <div key={event.id} className="event"><i className={event.type} /><span>{event.timestamp}</span><p>{event.label}</p>{index < demoEvents.length - 1 && <b />}</div>)}</div></section>
      </main>
      <AnimatePresence>{drawer && <><motion.button className="drawer-scrim" aria-label="Close control panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(null)} /><motion.aside className="workspace-control-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .4, ease: [0.22, 1, 0.36, 1] }}><button className="drawer-close" onClick={() => setDrawer(null)}><X size={16} /> CLOSE</button>{drawer === "controls" && <><span>OUTREACH / CONTROL</span><h2>Nothing moves without you.</h2><p>Set the operational boundary for this campaign. Production changes require an authenticated organization owner.</p><div className="control-stack"><label><i><Pause size={15} /><span><b>Campaign state</b><small>Pause discovery, drafting, and delivery together.</small></span></i><button className={campaignPaused ? "state-paused" : "state-running"} onClick={() => setCampaignPaused((value) => !value)}>{campaignPaused ? <><Play size={13} /> PAUSED</> : <><Pause size={13} /> RUNNING</>}</button></label><label><i><Gauge size={15} /><span><b>Daily delivery cap</b><small>Hard ceiling after all policy checks.</small></span></i><input type="number" defaultValue="10" min="1" max="25" /></label><label><i><Eye size={15} /><span><b>Catalogue visibility</b><small>Only approved fields become discoverable.</small></span></i><select defaultValue="review"><option value="private">Private</option><option value="review">Review before listing</option><option value="listed">Listed</option></select></label></div><div className="control-notice"><ShieldCheck size={15} /><p><b>Preview control</b>These settings are illustrative until identity and Convex persistence are connected.</p></div></>}{drawer === "discovery" && <><span>DISCOVERY / SCOPE</span><h2>Choose where the search travels.</h2><p>Focus research without narrowing away unexpected alignment.</p><div className="drawer-checks">{["US funds", "UK funds", "EU funds", "APAC funds", "Development finance", "Impact and blended capital"].map((item) => <label key={item}><input type="checkbox" defaultChecked /> {item}</label>)}</div><button className="button button-dark" onClick={() => setDrawer(null)}>Save preview scope</button></>}{drawer === "messages" && <><span>MESSAGES / REVIEW</span><h2>Eight drafts need a human.</h2><p>Every draft must be reviewed against its sources, claims, recipient type, and jurisdiction before approval.</p>{demoMatches.map((match) => <button className="drawer-message" key={match.id} onClick={() => { setSelected(match.id); setDrawer("draft"); }}><i>{match.score}</i><span><b>{match.firm}</b><small>Draft ready · not approved</small></span><ChevronRight size={15} /></button>)}</>}{drawer === "data" && <><span>PROFILE / VISIBILITY</span><h2>One profile, explicit boundaries.</h2><p>Private intake context is separate from catalogue fields and outreach claims.</p><div className="data-boundaries"><article><b>PRIVATE</b><p>Founder contact, internal notes, complete financial material.</p></article><article><b>OUTREACH-APPROVED</b><p>Selected traction, context, and factual claims used in drafts.</p></article><article><b>CATALOGUE-APPROVED</b><p>Public summary, strengths, open questions, and capital need.</p></article></div><Link className="button button-dark" href="/catalogue">Preview public listing <ArrowRight size={15} /></Link></>}{drawer === "draft" && <><span>DRAFT / HUMAN REVIEW</span><h2>{current.firm}</h2><p className="draft-subject">SUBJECT / Kivu Grid × {current.firm}</p><div className="draft-copy"><p>Hello {current.firm} team,</p><p>I’m building Kivu Grid, energy intelligence for commercial sites operating across unreliable grids. Your published focus on {current.thesis.toLowerCase()} appears directly relevant.</p><p>We currently support 20 paid sites with twelve months of measured operating data. Would the team be open to a short, context-first introduction?</p><p>Best,<br />Aline</p></div><div className="control-notice"><AlertTriangle size={15} /><p><b>Claims to verify</b>Paid-site count · measurement period · current thesis relevance.</p></div><button className="button button-dark" onClick={() => setDrawer(null)}>Keep as draft</button><button className="button button-outline-dark" disabled>Approve unavailable in preview</button></>}</motion.aside></>}</AnimatePresence>
    </div>
  );
}
