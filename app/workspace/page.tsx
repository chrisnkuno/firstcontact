import type { Metadata } from "next";
import { WorkspaceDashboard } from "@/components/workspace-dashboard";

export const metadata: Metadata = { title: "Workspace" };
export default function WorkspacePage() { return <WorkspaceDashboard />; }
