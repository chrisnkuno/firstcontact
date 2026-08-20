import type { Metadata } from "next";
import { AdminListingsPage } from "@/components/admin-pages";

export const metadata: Metadata = {
  title: "Listing review",
  robots: { index: false, follow: false },
};

export default function AdminListingsRoute() {
  return <AdminListingsPage />;
}
