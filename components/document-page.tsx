import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export function DocumentPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <main className="document-page"><header className="simple-header"><Logo /><Link href="/"><ArrowLeft size={16} /> Back home</Link></header><article><span>{eyebrow}</span><h1>{title}</h1><p className="document-intro">{intro}</p>{children}</article></main>;
}
