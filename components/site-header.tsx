"use client";

import Link from "next/link";
import { Code2, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link href="/#model">How it works</Link>
        <Link href="/#principles">Principles</Link>
        <Link href="/workspace">Founder workspace</Link>
        <Link href="/catalogue">VC catalogue</Link>
        <a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer"><Code2 size={16} /> GitHub</a>
      </nav>
      <Link className="button button-dark header-cta" href="/apply">Start a pipeline <span>↗</span></Link>
      <button className="menu-toggle" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
      <AnimatePresence>{open && <motion.div className="mobile-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }}><span>NAVIGATION / 00</span><nav><Link onClick={() => setOpen(false)} href="/#model">How it works <b>01</b></Link><Link onClick={() => setOpen(false)} href="/workspace">Founder workspace <b>02</b></Link><Link onClick={() => setOpen(false)} href="/catalogue">VC catalogue <b>03</b></Link><Link onClick={() => setOpen(false)} href="/open-source">Open source <b>04</b></Link></nav><Link className="button button-accent" onClick={() => setOpen(false)} href="/apply">Start a pipeline ↗</Link></motion.div>}</AnimatePresence>
    </header>
  );
}
