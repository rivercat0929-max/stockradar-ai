export type PushCapability = {
  supported: boolean;
  reason?: string;
};

export function getPushCapability(): PushCapability {
  if (typeof window === "undefined") {
    return { supported: false, reason: "server" };
  }

  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  return supported
    ? { supported: true }
    : { supported: false, reason: "browser-not-supported" };
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined") return "server";
  if (!("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}
