import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return <main className="not-found" id="main-content"><header className="simple-header"><Logo /><Link href="/"><ArrowLeft size={15} /> Home</Link></header><section><span>404 / SIGNAL LOST</span><h1>This route does not<br /><em>reach an ecosystem.</em></h1><p>The page may have moved, or the connection was never established.</p><div><Link className="button button-accent" href="/">Return home <ArrowRight size={15} /></Link><Link className="button button-dark" href="/catalogue">Browse the catalogue</Link></div></section></main>;
}
