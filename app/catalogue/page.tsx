import type { Metadata } from "next";
import { Catalogue } from "@/components/catalogue";

export const metadata: Metadata = { title: "VC catalogue", description: "Explore context-rich, founder-approved startup and institution profiles from overlooked ecosystems." };
export default function CataloguePage() { return <Catalogue />; }
