"use client";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

export type SupabaseBrowserSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};

export function getSupabaseBrowserConfig() {
  return getSupabasePublicConfig();
}

export async function sendMagicLink(email: string, redirectTo: string) {
  const config = getSupabaseBrowserConfig();
  if (!config.url || !config.anonKey) throw new Error("Supabase 尚未配置。");
  const response = await fetch(`${config.url}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey
    },
    body: JSON.stringify({
      email,
      type: "magiclink",
      options: { emailRedirectTo: redirectTo }
    })
  });
  if (!response.ok) throw new Error("登录链接发送失败。");
}

export function readSessionFromUrlHash(): SupabaseBrowserSession | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const expiresIn = Number(params.get("expires_in"));
  return {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") ?? undefined,
    expires_at: Number.isFinite(expiresIn) ? Math.floor(Date.now() / 1000) + expiresIn : undefined
  };
}
