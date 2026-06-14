import type { Alert, EventItem } from "@/lib/types";

export function getHighPriorityAlerts(alerts: Alert[]) {
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...alerts].sort((a, b) => rank[a.priority] - rank[b.priority]).filter((alert) => alert.status === "open");
}

export function eventsInNextSevenDays(events: EventItem[]) {
  return events.slice(0, 7);
}
