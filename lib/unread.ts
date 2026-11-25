import { useSyncExternalStore } from "react";
import { notificationsApi } from "@/lib/api/endpoints";

// One number shared by the header bell and the notifications page, so reading
// a notification updates the bell without a second request.

let unread = 0;
const listeners = new Set<() => void>();

export function setUnread(count: number) {
  if (count === unread) return;
  unread = count;
  listeners.forEach((listener) => listener());
}

export async function refreshUnread(): Promise<void> {
  setUnread((await notificationsApi.list({ unread_only: true, limit: 1 })).unread_count);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUnread(): number {
  return useSyncExternalStore(subscribe, () => unread, () => 0);
}
