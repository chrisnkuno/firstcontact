"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, ChevronRight, CirclePause, Database, Filter, Globe2, Mail, Search, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { demoEvents, demoMatches } from "@/lib/demo-data";

const filters = ["All", "US", "UK", "EU", "APAC"];

export function WorkspaceDashboard() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(demoMatches[0].id);
  const visible = useMemo(() => demoMatches.filter((match) => filter === "All" || match.region === filter), [filter]);
  const current = demoMatches.find((match) => match.id === selected) ?? demoMatches[0];
  return (
    <div className="workspace-layout">
      <aside className="workspace-nav">
        <div className="workspace-brand"><i /><span>FC</span></div>
        <nav><button className="active" title="Pipeline"><Globe2 /></button><button title="Discovery"><Search /></button><button title="Messages"><Mail /></button><button title="Data"><Database /></button></nav>
        <button className="avatar" title="Sample account">AK</button>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header"><div><span>PIPELINE / SAMPLE DATA</span><h1>Kivu Grid</h1></div><div className="mode-badge"><CirclePause size={14} /> PREVIEW — SENDING OFF</div></header>
        <section className="metric-grid">
          <article><span>DISCOVERED</span><strong>42</strong><small><i className="green" /> 4 capital regions</small></article>
          <article><span>QUALIFIED</span><strong>18</strong><small><i className="green" /> 43% thesis fit</small></article>
          <article><span>DRAFTED</span><strong>08</strong><small><i className="amber" /> Awaiting review</small></article>
          <article><span>SENT</span><strong>00</strong><small><i /> Live outbound disabled</small></article>
        </section>
        <div className="workspace-columns">
          <section className="matches-panel">
            <div className="panel-title"><div><span>INVESTOR MATCHES</span><small>Source-backed · ranked by fit</small></div><button><Filter size={14} /> FILTER</button></div>
            <div className="filter-row">{filters.map((name) => <button className={filter === name ? "active" : ""} key={name} onClick={() => setFilter(name)}>{name}</button>)}</div>
            <motion.div layout className="match-list"><AnimatePresence mode="popLayout">{visible.map((match) => <motion.button layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: .24 }} key={match.id} className={`match-row ${selected === match.id ? "selected" : ""}`} onClick={() => setSelected(match.id)}><span className="score">{match.score}</span><div><strong>{match.firm}</strong><p>{match.thesis}</p><small>{match.region} · {match.stages.join(" / ")}</small></div><ChevronRight size={17} /></motion.button>)}</AnimatePresence></motion.div>
          </section>
          <motion.aside key={current.id} className="detail-panel" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}>
            <div className="detail-head"><span>MATCH BRIEF</span><a href={current.sourceUrl} target="_blank" rel="noreferrer">SOURCE <ArrowUpRight size={13} /></a></div>
            <h2>{current.firm}</h2><p className="detail-thesis">{current.thesis}</p>
            <div className="score-block"><div><strong>{current.score}</strong><span>/ 100<br />FIT SCORE</span></div><div className="score-bar"><i style={{ width: `${current.score}%` }} /></div></div>
            <div className="evidence"><span>WHY THIS MATCH</span>{current.reasons.map((reason) => <p key={reason}><Check size={14} /> {reason}</p>)}</div>
            {current.risks.length > 0 && <div className="risk"><AlertTriangle size={15} /><p><b>REVIEW NOTE</b>{current.risks.join(". ")}</p></div>}
            <button className="button button-dark full"><Sparkles size={16} /> Draft introduction</button>
            <p className="action-note"><ShieldCheck size={13} /> Drafting does not send email.</p>
          </motion.aside>
        </div>
        <section className="activity-panel"><div className="panel-title"><div><span>PIPELINE ACTIVITY</span><small>Append-only operational history</small></div></div><div className="event-row">{demoEvents.map((event, index) => <div key={event.id} className="event"><i className={event.type} /><span>{event.timestamp}</span><p>{event.label}</p>{index < demoEvents.length - 1 && <b />}</div>)}</div></section>
      </main>
    </div>
  );
}
