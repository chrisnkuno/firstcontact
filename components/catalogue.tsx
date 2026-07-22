"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronDown, MapPin, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/logo";
import { catalogueProfiles, type CatalogueProfile } from "@/lib/catalogue-data";

const regions = ["All regions", "Africa", "Latin America", "MENA", "South Asia", "Southeast Asia"];
const types = ["All", "Startup", "Institution"];

export function Catalogue() {
  const [region, setRegion] = useState("All regions");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState<CatalogueProfile | null>(null);
  const [interest, setInterest] = useState(false);
  const visible = useMemo(() => catalogueProfiles.filter((profile) => (region === "All regions" || profile.region === region) && (type === "All" || profile.type === type)), [region, type]);
  return <main className="catalogue-page" id="main-content">
    <header className="catalogue-header"><Logo /><nav><Link href="/"><ArrowLeft size={14} /> Home</Link><Link href="/workspace">Founder workspace</Link><a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer">GitHub ↗</a></nav><span>INVESTOR VIEW / PUBLIC PREVIEW</span></header>
    <section className="catalogue-intro"><div><span>CURATED OPPORTUNITY FLOW / 01</span><h1>Context before<br /><em>the pitch.</em></h1></div><div><p>Explore founder-approved profiles from ecosystems that conventional deal flow often misses. Understand the operating context, strengths, open questions, and capital fit before requesting an introduction.</p><small>All organizations shown are illustrative preview profiles. A live catalogue requires verified organizations, investor authentication, and explicit listing consent.</small></div></section>
    <section className="catalogue-controls"><div className="catalogue-tabs">{types.map((item) => <button className={type === item ? "active" : ""} key={item} onClick={() => setType(item)}>{item}</button>)}</div><label><MapPin size={14} /><select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label><span><SlidersHorizontal size={13} /> {visible.length.toString().padStart(2, "0")} PROFILES</span></section>
    <motion.section layout className="catalogue-grid"><AnimatePresence initial={false} mode="popLayout">{visible.map((profile, index) => <motion.button layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} key={profile.id} className={`catalogue-card card-${index % 5}`} onClick={() => { setSelected(profile); setInterest(false); }} style={{ "--card-accent": profile.accent } as React.CSSProperties}><div className="catalogue-card-top"><span>{profile.type.toUpperCase()} / {profile.stage.toUpperCase()}</span><i /></div><h2>{profile.name}</h2><p>{profile.oneLiner}</p><div className="catalogue-tags">{profile.sectors.map((sector) => <span key={sector}>{sector}</span>)}</div><div className="catalogue-card-bottom"><span>{profile.location}</span><b>{profile.raise}</b></div><ArrowRight className="card-arrow" /></motion.button>)}</AnimatePresence></motion.section>
    <footer className="catalogue-footer"><p>Want to be considered for the catalogue?</p><Link className="button button-dark" href="/apply">Create an organization profile <ArrowRight size={16} /></Link></footer>
    <AnimatePresence>{selected && <><motion.button aria-label="Close profile" className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} /><motion.aside className="catalogue-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}><button className="drawer-close" onClick={() => setSelected(null)}><X size={17} /> CLOSE</button><div className="drawer-index">PROFILE / {selected.id.toUpperCase()}</div><h2>{selected.name}</h2><p className="drawer-location"><MapPin size={13} /> {selected.location} · {selected.type} · {selected.stage}</p><p className="drawer-lead">{selected.oneLiner}</p><section><span>WHY CONTEXT MATTERS</span><p>{selected.context}</p></section><div className="drawer-columns"><section><span>STRENGTHS</span>{selected.strengths.map((item) => <p key={item}><Check size={13} /> {item}</p>)}</section><section className="considerations"><span>OPEN QUESTIONS</span>{selected.considerations.map((item) => <p key={item}>— {item}</p>)}</section></div><div className="deal-strip"><div><span>TRACTION</span><b>{selected.traction}</b></div><div><span>SEEKING</span><b>{selected.raise} · {selected.instrument}</b></div></div>{interest ? <div className="interest-confirm"><Check size={20} /><div><b>Interest saved in this preview.</b><p>A configured deployment would notify the organization without exposing private contact data.</p></div></div> : <button className="button button-accent drawer-action" onClick={() => setInterest(true)}>Express interest <ArrowRight size={16} /></button>}<small className="verified-line">{selected.verified} · Public fields approved for catalogue display</small></motion.aside></>}</AnimatePresence>
  </main>;
}
