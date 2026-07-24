"use client";

import Link from "next/link";
import { Code2, LogIn, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { T } from "@/components/translation-provider";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link href="/how-it-works"><T>How it works</T></Link>
        <Link href="/principles"><T>Principles</T></Link>
        <Link href="/plan"><T>Plan</T></Link>
        <Link href="/pacing"><T>Pacing</T></Link>
        <Link href="/workspace"><T>Founder workspace</T></Link>
        <Link href="/catalogue"><T>VC catalogue</T></Link>
        <a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer"><Code2 size={16} /> GitHub</a>
        <LanguageSwitcher />
      </nav>
      <Link className="text-link header-login" href="/status"><LogIn size={15} /> <T>Participant login</T></Link>
      <Link className="button button-dark header-cta" href="/signup"><T>Join FirstContact</T> <span>↗</span></Link>
      <button className="menu-toggle" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
      <AnimatePresence>{open && <motion.div className="mobile-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }}><span>NAVIGATION / 00</span><nav><Link onClick={() => setOpen(false)} href="/how-it-works"><T>How it works</T> <b>01</b></Link><Link onClick={() => setOpen(false)} href="/principles"><T>Principles</T> <b>02</b></Link><Link onClick={() => setOpen(false)} href="/plan"><T>Outreach planner</T> <b>03</b></Link><Link onClick={() => setOpen(false)} href="/pacing"><T>Portfolio pacing</T> <b>04</b></Link><Link onClick={() => setOpen(false)} href="/workspace"><T>Founder workspace</T> <b>05</b></Link><Link onClick={() => setOpen(false)} href="/catalogue"><T>VC catalogue</T> <b>06</b></Link><Link onClick={() => setOpen(false)} href="/open-source"><T>Open source</T> <b>07</b></Link></nav><Link className="button button-outline" onClick={() => setOpen(false)} href="/status"><LogIn size={16} /> <T>Participant login</T></Link><LanguageSwitcher className="mobile" /><Link className="button button-accent" onClick={() => setOpen(false)} href="/signup"><T>Join FirstContact</T> ↗</Link></motion.div>}</AnimatePresence>
    </header>
  );
}
