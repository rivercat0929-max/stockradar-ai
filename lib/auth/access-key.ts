import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const accessCookieName = "stockradar_access_granted";
const maxAge = 60 * 60 * 24 * 30;

export type AccessCheck =
  | { ok: true }
  | { ok: false; status: number; message: string };

export function isAccessKeyConfigured() {
  return Boolean(process.env.STOCKRADAR_ACCESS_KEY?.trim());
}

export function verifyAccessKey(value: unknown): boolean {
  const expected = process.env.STOCKRADAR_ACCESS_KEY?.trim();
  if (!expected || typeof value !== "string") {
    return false;
  }
  return safeEqual(value, expected);
}

export function createAccessCookieValue() {
  const key = process.env.STOCKRADAR_ACCESS_KEY?.trim();
  if (!key) return "";
  return signValue("stockradar-access", key);
}

export function validateAccessCookie(value?: string | null) {
  const expected = createAccessCookieValue();
  return Boolean(value && expected && safeEqual(value, expected));
}

export function requirePersonalAccess(request?: Request): AccessCheck {
  if (!isAccessKeyConfigured()) return { ok: false, status: 503, message: "访问密码尚未配置。" };
  const cookieValue = getCookieFromRequest(request) ?? cookies().get(accessCookieName)?.value;
  if (!validateAccessCookie(cookieValue)) return { ok: false, status: 401, message: "请先在设置页解锁个人数据。" };
  return { ok: true };
}

export function accessErrorResponse(access: AccessCheck) {
  if (access.ok) return Response.json({ success: true });
  return Response.json({ success: false, error: access.message }, { status: access.status });
}

export function setAccessCookie() {
  cookies().set(accessCookieName, createAccessCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  });
}

export function clearAccessCookie() {
  cookies().delete(accessCookieName);
}

function getCookieFromRequest(request?: Request) {
  const header = request?.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${accessCookieName}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function signValue(value: string, key: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
