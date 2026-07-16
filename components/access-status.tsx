"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AccessStatus() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    fetch("/api/access", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setUnlocked(Boolean(data.unlocked)))
      .catch(() => setUnlocked(false));
  }, []);

  async function lock() {
    await fetch("/api/access", { method: "DELETE" });
    setUnlocked(false);
    router.push("/settings");
  }

  if (!unlocked) return <span className="text-xs text-slate-400">未解锁</span>;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span>已解锁</span>
      <button onClick={lock} className="rounded border border-slate-700 px-2 py-1 font-semibold hover:bg-slate-900">退出解锁</button>
    </div>
  );
}
