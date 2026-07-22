import Link from "next/link";
import { ArrowRight, Check, Code2, Globe2, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { WorldSignal } from "@/components/world-signal";

const steps = [
  ["01", "Tell the whole story", "Founders share traction, context, ambition, and the local truths a deck often leaves out.", Sparkles],
  ["02", "Map aligned capital", "Exa discovers firms and decision-makers. Every claim carries a source; every match carries a reason.", Radar],
  ["03", "Approve the approach", "AI drafts a specific introduction. The founder reviews the recipient, evidence, and message before anything leaves.", ShieldCheck],
  ["04", "Learn from signals", "Delivery, replies, meetings, and passes become transparent pipeline events—not vanity metrics.", Globe2],
] as const;

export default function Home() {
  return (
    <main id="main-content">
      <SiteHeader />
      <section className="hero section-shell">
        <div className="eyebrow"><span>OPEN SOURCE / GLOBAL CAPITAL ACCESS</span><b>v0.1</b></div>
        <div className="hero-copy">
          <h1>Capital should<br />travel <em>further.</em></h1>
          <p>FirstContact is open infrastructure for founders and institutions outside capital-dense ecosystems to find, understand, and thoughtfully approach aligned investors worldwide.</p>
          <div className="hero-actions">
            <Link className="button button-accent" href="/apply">Build your pipeline <ArrowRight size={18} /></Link>
            <Link className="text-link" href="/open-source"><Code2 size={17} /> Explore the source</Link>
          </div>
          <div className="trust-line"><span><Check size={13} /> Human-approved outreach</span><span><Check size={13} /> Source-backed matches</span><span><Check size={13} /> No contact-data resale</span></div>
        </div>
        <WorldSignal />
      </section>

      <section className="thesis-band">
        <p>THE PROBLEM</p>
        <blockquote>Talent is evenly distributed.<br /><em>Access is not.</em></blockquote>
        <div className="thesis-copy">Warm networks still decide who gets heard. FirstContact makes investor discovery and context-rich introductions legible, repeatable, and available to ecosystems the traditional venture map overlooks.</div>
      </section>

      <section className="model section-shell" id="model">
        <div className="section-heading"><span>01 / THE MODEL</span><h2>From local context<br />to global signal.</h2><p>Automation does the research and repetitive work. People retain agency at every consequential step.</p></div>
        <div className="step-grid">
          {steps.map(([number, title, description, Icon]) => (
            <article className="step" key={number}><div className="step-top"><span>{number}</span><Icon size={22} /></div><h3>{title}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>

      <section className="system-section section-shell">
        <div className="section-heading"><span>02 / THE SYSTEM</span><h2>One clear path.<br />Four accountable layers.</h2><p>Each provider has one job. Each transition leaves evidence. Nothing sends merely because a model suggested it.</p></div>
        <div className="system-bento">
          <article className="bento-discover"><span>01 / DISCOVER</span><h3>Search the public record.</h3><p>Exa maps firms, people, mandates, portfolios, and current thesis evidence across four capital regions.</p><div className="mini-flow"><i>PROFILE</i><b>→</b><i>SOURCES</i><b>→</b><i>SHORTLIST</i></div></article>
          <article className="bento-draft"><span>02 / INTERPRET</span><h3>Explain the fit.</h3><p>Transparent scoring plus GPT-5 nano turns evidence into match reasons, risks, and a factual first draft.</p><strong>94<small>/100</small></strong></article>
          <article className="bento-control"><span>03 / CONTROL</span><h3>People hold the edge.</h3><p>Approval, jurisdiction, identity, suppression, and rate-limit gates all fail closed.</p><ul><li>Source verified</li><li>Human approved</li><li>Suppression clear</li></ul></article>
          <article className="bento-learn"><span>04 / LEARN</span><h3>A pipeline, not a blast.</h3><p>Resend delivery events and replies become an auditable history founders can act on.</p><div className="signal-line"><i /><i /><i /><i /></div></article>
        </div>
      </section>

      <section className="principles section-shell" id="principles">
        <div><span className="kicker">03 / BUILT DIFFERENTLY</span><h2>Outreach without<br />the growth-hack<br />playbook.</h2></div>
        <div className="principle-list">
          <article><b>01</b><div><h3>Evidence before inference</h3><p>Investor mandates, portfolio patterns, and contact details remain linked to their public source and discovery date.</p></div></article>
          <article><b>02</b><div><h3>Permission at the edge</h3><p>No hidden auto-send. Live email requires operator enablement, policy checks, suppression screening, and a human approval.</p></div></article>
          <article><b>03</b><div><h3>Founders own the narrative</h3><p>AI can structure and draft, but it cannot invent traction, impersonate a founder, or overwrite their context.</p></div></article>
          <article><b>04</b><div><h3>Open by default</h3><p>Portable data, inspectable scoring, replaceable providers, and documentation deep enough to run independently.</p></div></article>
        </div>
      </section>

      <section className="two-sides section-shell">
        <div className="section-heading"><span>04 / TWO USEFUL VIEWS</span><h2>Agency for founders.<br />Context for capital.</h2><p>Each side sees only what it needs. Organizations govern their narrative and outreach; investors browse consented, decision-useful context.</p></div>
        <div className="two-side-grid"><article><span>FOR STARTUPS + INSTITUTIONS</span><h3>Control the pipeline.</h3><p>Review matches, approve specific messages, choose catalogue visibility, set campaign pace, and pause outreach at any time.</p><Link href="/workspace">Open founder workspace <ArrowRight size={16} /></Link></article><article><span>FOR INVESTORS</span><h3>Browse beyond the usual network.</h3><p>Filter a curated flow by geography, stage, sector, and organization type. See strengths, open questions, context, and capital needs before expressing interest.</p><Link href="/catalogue">Explore the VC catalogue <ArrowRight size={16} /></Link></article></div>
      </section>

      <section className="cta section-shell">
        <span>MAKE THE FIRST CONTACT</span><h2>Your geography should be context.<br /><em>Not a constraint.</em></h2>
        <div><Link className="button button-light" href="/apply">Create an organization profile <ArrowRight size={18} /></Link><Link className="button button-outline" href="/catalogue">Browse the catalogue</Link></div>
      </section>
      <footer className="footer section-shell"><div><strong>FIRSTCONTACT</strong><p>Open infrastructure for capital access.<br />Built with care, from everywhere.</p></div><div><span>PRODUCT</span><Link href="/workspace">Founder workspace</Link><Link href="/catalogue">VC catalogue</Link><Link href="/apply">Organization intake</Link></div><div><span>PROJECT + POLICIES</span><a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/responsible-outreach">Responsible outreach</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/security">Security</Link></div><p className="license">MIT · FirstContact contributors</p></footer>
    </main>
  );
}
