"use client";

import { motion } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div className="page-slide" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}
