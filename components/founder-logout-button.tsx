"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

export function FounderLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/founder/logout", { method: "POST" });
    } finally {
      router.refresh();
    }
  }

  return (
    <button className="button button-outline-dark" onClick={logout} disabled={loading}>
      {loading ? <LoaderCircle className="spin" size={14} /> : <LogOut size={14} />} Log out
    </button>
  );
}
