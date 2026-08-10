import Link from "next/link";
import { ArrowRight, Check, Code2, Globe2, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { WorldSignal } from "@/components/world-signal";
import { NetworkSignal } from "@/components/network-signal";
import { EconomicsFlywheel } from "@/components/economics-flywheel";
import { T } from "@/components/translation-provider";

export const revalidate = 60;

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
          <h1><T>Capital should</T><br /><T>travel </T><em><T>further.</T></em></h1>
          <p><T>FirstContact is open infrastructure for founders and institutions outside capital-dense ecosystems to find, understand, and thoughtfully approach aligned investors worldwide.</T></p>
          <div className="hero-actions">
            <Link className="button button-accent" href="/signup"><T>Join FirstContact</T> <ArrowRight size={18} /></Link>
            <Link className="text-link" href="/open-source"><Code2 size={17} /> <T>Explore the source</T></Link>
          </div>
          <div className="trust-line"><span><Check size={13} /> <T>Human-approved outreach</T></span><span><Check size={13} /> <T>Source-backed matches</T></span><span><Check size={13} /> <T>No contact-data resale</T></span></div>
        </div>
        <WorldSignal />
      </section>

      <NetworkSignal />

      <section className="thesis-band">
        <p>THE PROBLEM</p>
        <blockquote><T>Talent is evenly distributed.</T><br /><em><T>Access is not.</T></em></blockquote>
        <div className="thesis-copy"><T>Warm networks still decide who gets heard. FirstContact makes investor discovery and context-rich introductions legible, repeatable, and available to ecosystems the traditional venture map overlooks.</T></div>
      </section>

      <EconomicsFlywheel />

      <section className="capital-research-callout section-shell" aria-labelledby="capital-research-heading">
        <div>
          <span>NEW RESEARCH / THE FULL CAPITAL LIFECYCLE</span>
          <h2 id="capital-research-heading"><T>Different capital.</T><br /><T>Different jobs.</T></h2>
        </div>
        <div>
          <p><T>See how angels, venture capital, philanthropy and DFIs, growth equity, private credit, private equity, search funds, strategic buyers, and secondaries can work as one responsible path from first risk to recycled liquidity.</T></p>
          <div className="capital-research-tags" aria-label="Capital types covered">
            {["ANGELS", "VENTURE", "PHILANTHROPY", "GROWTH", "CREDIT", "PRIVATE EQUITY", "BUYERS", "SECONDARIES"].map((item) => <span key={item}>{item}</span>)}
          </div>
          <Link className="button button-dark" href="/research/private-equity"><T>Read the capital lifecycle brief</T> <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="model section-shell" id="model">
        <div className="section-heading"><span>01 / THE MODEL</span><h2><T>From local context</T><br /><T>to global signal.</T></h2><p><T>Automation does the research and repetitive work. People retain agency at every consequential step.</T></p></div>
        <div className="step-grid">
          {steps.map(([number, title, description, Icon]) => (
            <article className="step" key={number}><div className="step-top"><span>{number}</span><Icon size={22} /></div><h3><T>{title}</T></h3><p><T>{description}</T></p></article>
          ))}
        </div>
        <Link className="text-link section-more" href="/how-it-works"><T>See how each step works</T> <ArrowRight size={16} /></Link>
      </section>

      <section className="system-section section-shell">
        <div className="section-heading"><span>02 / THE SYSTEM</span><h2><T>One clear path.</T><br /><T>Four accountable layers.</T></h2><p><T>Each provider has one job. Each transition leaves evidence. Nothing sends merely because a model suggested it.</T></p></div>
        <div className="system-bento">
          <article className="bento-discover"><span>01 / DISCOVER</span><h3><T>Search the public record.</T></h3><p><T>Exa maps firms, people, mandates, portfolios, and current thesis evidence across four capital regions.</T></p><ol className="mini-flow"><li><b>01</b><strong><T>Profile</T></strong><small><T>founder context</T></small></li><li><b>02</b><strong><T>Sources</T></strong><small><T>public record</T></small></li><li><b>03</b><strong><T>Shortlist</T></strong><small><T>ranked, each claim cited</T></small></li></ol></article>
          <article className="bento-draft"><span>02 / INTERPRET</span><h3><T>Explain the fit.</T></h3><p><T>Transparent scoring plus GPT-5 nano turns evidence into match reasons, risks, and a factual first draft.</T></p><strong>94<small>/100</small></strong></article>
          <article className="bento-control"><span>03 / CONTROL</span><h3><T>People hold the edge.</T></h3><p><T>Approval, jurisdiction, identity, suppression, and rate-limit gates all fail closed.</T></p><ul><li><T>Source verified</T></li><li><T>Human approved</T></li><li><T>Suppression clear</T></li></ul></article>
          <article className="bento-learn"><span>04 / LEARN</span><h3><T>A pipeline, not a blast.</T></h3><p><T>Resend delivery events and replies become an auditable history founders can act on.</T></p><ol className="signal-line"><li><T>Sent</T></li><li><T>Delivered</T></li><li><T>Opened</T></li><li><T>Replied</T></li></ol></article>
        </div>
        <Link className="text-link section-more" href="/system"><T>Read the full system, real vs. preview</T> <ArrowRight size={16} /></Link>
      </section>

      <section className="principles section-shell" id="principles">
        <div><span className="kicker">03 / BUILT DIFFERENTLY</span><h2><T>Outreach without</T><br /><T>the growth-hack</T><br /><T>playbook.</T></h2></div>
        <div className="principle-list">
          <article><b>01</b><div><h3><T>Evidence before inference</T></h3><p><T>Investor mandates, portfolio patterns, and contact details remain linked to their public source and discovery date.</T></p></div></article>
          <article><b>02</b><div><h3><T>Permission at the edge</T></h3><p><T>No hidden auto-send. Live email requires operator enablement, policy checks, suppression screening, and a human approval.</T></p></div></article>
          <article><b>03</b><div><h3><T>Founders own the narrative</T></h3><p><T>AI can structure and draft, but it cannot invent traction, impersonate a founder, or overwrite their context.</T></p></div></article>
          <article><b>04</b><div><h3><T>Open by default</T></h3><p><T>Portable data, inspectable scoring, replaceable providers, and documentation deep enough to run independently.</T></p></div></article>
        </div>
        <Link className="text-link section-more" href="/principles"><T>Read the full principles</T> <ArrowRight size={16} /></Link>
      </section>

      <section className="two-sides section-shell">
        <div className="section-heading"><span>04 / TWO USEFUL VIEWS</span><h2><T>Agency for founders.</T><br /><T>Context for capital.</T></h2><p><T>Each side sees only what it needs. Organizations govern their narrative and outreach; investors browse consented, decision-useful context.</T></p></div>
        <div className="two-side-grid">
          <article><span>FOR STARTUPS + INSTITUTIONS</span><h3><T>Control the pipeline.</T></h3><p><T>Review matches, approve specific messages, choose catalogue visibility, set campaign pace, and pause outreach at any time.</T></p><Link href="/dashboard"><T>Open your dashboard</T> <ArrowRight size={16} /></Link><Link className="text-link section-more" href="/for-founders"><T>What founders get</T> <ArrowRight size={16} /></Link><Link className="text-link section-more" href="/plan"><T>Plan your raise with real math</T> <ArrowRight size={16} /></Link></article>
          <article><span>FOR INVESTORS</span><h3><T>Browse beyond the usual network.</T></h3><p><T>Filter a curated flow by geography, stage, sector, and organization type. See strengths, open questions, context, and capital needs before expressing interest.</T></p><Link href="/catalogue"><T>Explore the VC catalogue</T> <ArrowRight size={16} /></Link><Link className="text-link section-more" href="/for-investors"><T>What investors get</T> <ArrowRight size={16} /></Link><Link className="text-link section-more" href="/pacing"><T>Pace your deal flow with real math</T> <ArrowRight size={16} /></Link></article>
        </div>
      </section>

      <section className="cta section-shell">
        <span>MAKE THE FIRST CONTACT</span><h2><T>Your geography should be context.</T><br /><em><T>Not a constraint.</T></em></h2>
        <div><Link className="button button-light" href="/signup"><T>Create your profile</T> <ArrowRight size={18} /></Link><Link className="button button-outline" href="/catalogue"><T>Browse the catalogue</T></Link></div>
      </section>
      <footer className="footer section-shell"><div><strong>FIRSTCONTACT</strong><p><T>Open infrastructure for capital access.</T><br /><T>Built with care, from everywhere.</T></p></div><div><span>PRODUCT</span><Link href="/dashboard"><T>Your dashboard</T></Link><Link href="/catalogue"><T>VC catalogue</T></Link><Link href="/research/private-equity"><T>Capital lifecycle research</T></Link><Link href="/signup"><T>Join FirstContact</T></Link><Link href="/signin"><T>Participant login</T></Link></div><div><span>PROJECT + POLICIES</span><a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/open-source"><T>Open source</T></Link><Link href="/how-it-works"><T>How it works</T></Link><Link href="/system"><T>The system</T></Link><Link href="/responsible-outreach"><T>Responsible outreach</T></Link><Link href="/privacy"><T>Privacy</T></Link><Link href="/terms"><T>Terms</T></Link><Link href="/security"><T>Security</T></Link></div><p className="license">MIT · FirstContact contributors</p></footer>
    </main>
  );
}
