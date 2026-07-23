"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronDown, LoaderCircle, MapPin, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { T } from "@/components/translation-provider";
import { catalogueProfiles, type CatalogueProfile } from "@/lib/catalogue-data";

const regions = ["All regions", "Africa", "Latin America", "MENA", "South Asia", "Southeast Asia"];
const types = ["All", "Startup", "Institution"];

type InterestPhase = "idle" | "form" | "sending" | "sent" | "error";

export function Catalogue() {
  const [region, setRegion] = useState("All regions");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState<CatalogueProfile | null>(null);
  const [interestPhase, setInterestPhase] = useState<InterestPhase>("idle");
  const [interestEmail, setInterestEmail] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [interestError, setInterestError] = useState("");
  const visible = useMemo(() => catalogueProfiles.filter((profile) => (region === "All regions" || profile.region === region) && (type === "All" || profile.type === type)), [region, type]);

  function openProfile(profile: CatalogueProfile) {
    setSelected(profile);
    setInterestPhase("idle");
    setInterestEmail("");
    setInterestNote("");
    setInterestError("");
  }

  async function sendInterest(profileId: string) {
    setInterestPhase("sending");
    setInterestError("");
    try {
      const response = await fetch("/api/catalogue-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, email: interestEmail, note: interestNote }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Your interest could not be saved.");
      }
      setInterestPhase("sent");
    } catch (submissionError) {
      setInterestError(
        submissionError instanceof Error ? submissionError.message : "Your interest could not be saved.",
      );
      setInterestPhase("error");
    }
  }
  return <main className="catalogue-page" id="main-content">
    <header className="catalogue-header"><Logo /><nav><Link href="/"><ArrowLeft size={14} /> <T>Home</T></Link><Link href="/workspace"><T>Founder workspace</T></Link><a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer">GitHub ↗</a><LanguageSwitcher /></nav><span>INVESTOR VIEW / PUBLIC PREVIEW</span></header>
    <section className="catalogue-intro"><div><span>CURATED OPPORTUNITY FLOW / 01</span><h1><T>Context before</T><br /><em><T>the pitch.</T></em></h1></div><div><p><T>Explore founder-approved profiles from ecosystems that conventional deal flow often misses. Understand the operating context, strengths, open questions, and capital fit before requesting an introduction.</T></p><small><T>All organizations shown are illustrative preview profiles. A live catalogue requires verified organizations, investor authentication, and explicit listing consent.</T></small></div></section>
    <section className="catalogue-controls"><div className="catalogue-tabs">{types.map((item) => <button className={type === item ? "active" : ""} key={item} onClick={() => setType(item)}><T>{item}</T></button>)}</div><label><MapPin size={14} /><select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label><span><SlidersHorizontal size={13} /> {visible.length.toString().padStart(2, "0")} PROFILES</span></section>
    <motion.section layout className="catalogue-grid"><AnimatePresence initial={false} mode="popLayout">{visible.map((profile, index) => <motion.button layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} key={profile.id} className={`catalogue-card card-${index % 5}`} onClick={() => openProfile(profile)} style={{ "--card-accent": profile.accent } as React.CSSProperties}><div className="catalogue-card-top"><span>{profile.type.toUpperCase()} / {profile.stage.toUpperCase()}</span><i /></div><h2>{profile.name}</h2><p><T>{profile.oneLiner}</T></p><div className="catalogue-tags">{profile.sectors.map((sector) => <span key={sector}><T>{sector}</T></span>)}</div><div className="catalogue-card-bottom"><span>{profile.location}</span><b>{profile.raise}</b></div><ArrowRight className="card-arrow" /></motion.button>)}</AnimatePresence></motion.section>
    <footer className="catalogue-footer"><p><T>Want to be considered for the catalogue?</T></p><Link className="button button-dark" href="/signup"><T>Create your profile</T> <ArrowRight size={16} /></Link></footer>
    <AnimatePresence>{selected && <><motion.button aria-label="Close profile" className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} /><motion.aside className="catalogue-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}><button className="drawer-close" onClick={() => setSelected(null)}><X size={17} /> CLOSE</button><div className="drawer-index">PROFILE / {selected.id.toUpperCase()}</div><h2>{selected.name}</h2><p className="drawer-location"><MapPin size={13} /> {selected.location} · <T>{selected.type}</T> · <T>{selected.stage}</T></p><p className="drawer-lead"><T>{selected.oneLiner}</T></p><section><span>WHY CONTEXT MATTERS</span><p><T>{selected.context}</T></p></section><div className="drawer-columns"><section><span>STRENGTHS</span>{selected.strengths.map((item) => <p key={item}><Check size={13} /> <T>{item}</T></p>)}</section><section className="considerations"><span>OPEN QUESTIONS</span>{selected.considerations.map((item) => <p key={item}>— <T>{item}</T></p>)}</section></div><div className="deal-strip"><div><span>TRACTION</span><b>{selected.traction}</b></div><div><span>SEEKING</span><b>{selected.raise} · <T>{selected.instrument}</T></b></div></div>{interestPhase === "idle" && (
              <button className="button button-accent drawer-action" onClick={() => setInterestPhase("form")}>
                <T>Express interest</T> <ArrowRight size={16} />
              </button>
            )}
            {(interestPhase === "form" || interestPhase === "sending" || interestPhase === "error") && (
              <form
                className="interest-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendInterest(selected.id);
                }}
              >
                <label>
                  <T>Your email</T>
                  <input
                    required
                    type="email"
                    value={interestEmail}
                    onChange={(event) => setInterestEmail(event.target.value)}
                    placeholder="you@fund.com"
                    autoComplete="email"
                  />
                </label>
                <label>
                  <T>Note</T> <small>OPTIONAL</small>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={interestNote}
                    onChange={(event) => setInterestNote(event.target.value)}
                    placeholder="A short note the team will see alongside your interest."
                  />
                </label>
                {interestPhase === "error" && <p className="interest-error">{interestError}</p>}
                <button className="button button-accent drawer-action" type="submit" disabled={interestPhase === "sending"}>
                  {interestPhase === "sending" ? <><LoaderCircle className="spin" size={16} /> <T>Sending</T></> : <><T>Send interest</T> <ArrowRight size={16} /></>}
                </button>
              </form>
            )}
            {interestPhase === "sent" && (
              <div className="interest-confirm">
                <Check size={20} />
                <div>
                  <b><T>Interest recorded.</T></b>
                  <p><T>Saved as a real, timestamped signal against this profile — not local-only preview state. No private founder contact data is exposed to you.</T></p>
                </div>
              </div>
            )}
            <small className="verified-line">{selected.verified} · <T>Public fields approved for catalogue display</T></small></motion.aside></>}</AnimatePresence>
  </main>;
}
