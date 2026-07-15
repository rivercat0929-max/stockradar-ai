"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthStatus() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setEmail(data?.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }

  if (!email) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span>{email}</span>
      <button onClick={logout} className="rounded border border-slate-700 px-2 py-1 font-semibold hover:bg-slate-900">退出</button>
    </div>
  );
}
