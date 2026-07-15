"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readSessionFromUrlHash, sendMagicLink } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">正在加载登录页...</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const session = readSessionFromUrlHash();
    if (!session) return;
    setIsLoading(true);
    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session)
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error ?? "登录失败。");
        window.history.replaceState(null, "", "/login");
        router.replace(searchParams.get("next") || "/");
      })
      .catch((loginError) => setError(loginError instanceof Error ? loginError.message : "登录失败。"))
      .finally(() => setIsLoading(false));
  }, [router, searchParams]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const redirectTo = `${window.location.origin}/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`;
      await sendMagicLink(email.trim(), redirectTo);
      setMessage("登录链接已发送，请检查邮箱。");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "登录链接发送失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-signal">StockRadar AI</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">个人投资决策系统</h1>
        <p className="mt-3 text-sm leading-6 text-muted">本系统目前为个人使用版本，仅授权账户可以访问。</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-ink">邮箱</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal" placeholder="you@example.com" />
          </label>
          <button disabled={isLoading} className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? "正在发送..." : "发送登录链接"}
          </button>
        </form>
        {message ? <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </main>
  );
}
