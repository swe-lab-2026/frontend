"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { refreshUnread, useUnread } from "@/lib/unread";
import { usePolling } from "@/lib/usePolling";

const REFRESH = 60_000;

/** Signed-in users only. */
export function NotificationBell() {
  const { t } = useI18n();
  const pathname = usePathname();
  const unread = useUnread();

  usePolling(refreshUnread, REFRESH);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? fmt(t.nav.unread, { count: unread }) : t.nav.notifications}
      aria-current={pathname === "/notifications" ? "page" : undefined}
      className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-chip aria-[current=page]:bg-chip"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
