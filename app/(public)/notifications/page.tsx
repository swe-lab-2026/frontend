"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireAuth } from "@/components/support/RequireAuth";
import { Alert, Badge, Button, Card, CardHeader, PageLoader } from "@/components/ui";
import { notificationsApi } from "@/lib/api/endpoints";
import type { AppNotification, NotificationPage } from "@/lib/api/types";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { mapLimited } from "@/lib/history";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { notificationHref, notificationText } from "@/lib/notifications";
import { refreshUnread, setUnread } from "@/lib/unread";
import { useApi } from "@/lib/useApi";

const PAGE = 20;
const API_MAX = 100;

function Notifications() {
  const { t, intlLocale } = useI18n();
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const { data, error, reload } = useApi<{ unreadOnly: boolean; page: NotificationPage }>(
    () =>
      notificationsApi.list({ unread_only: unreadOnly, limit, offset: 0 }).then((page) => {
        setUnread(page.unread_count);
        return { unreadOnly, page };
      }),
    [unreadOnly, limit],
  );
  const page = data?.unreadOnly === unreadOnly ? data.page : null;

  async function open(item: AppNotification, href: string) {
    // Opening the page matters more than the read mark, so a failure is ignored.
    if (!item.read_at) void notificationsApi.markRead(item.id).then(refreshUnread).catch(() => undefined);
    router.push(href);
  }

  async function run(name: string, task: () => Promise<unknown>) {
    setBusy(name);
    setActionError(null);
    try {
      await task();
    } catch (err) {
      setActionError(err);
    } finally {
      reload();
      setBusy(null);
    }
  }

  // The API marks one notification at a time.
  async function markAll() {
    for (;;) {
      const { items } = await notificationsApi.list({ unread_only: true, limit: API_MAX, offset: 0 });
      if (items.length === 0) return;
      await mapLimited(items, 5, (item) => notificationsApi.markRead(item.id));
    }
  }

  return (
    <Card aria-labelledby="notifications-h" className="mx-auto w-full max-w-[880px]">
      <title>{`${t.notifications.title} — BiletFlow`}</title>
      <CardHeader
        as="h1"
        id="notifications-h"
        title={t.notifications.title}
        description={t.notifications.hint}
        action={
          <Button variant="secondary" loading={busy === "all"} disabled={busy !== null || !page?.unread_count} onClick={() => run("all", markAll)}>
            {t.notifications.markAll}
          </Button>
        }
      />
      <div role="group" aria-label={t.notifications.title} className="flex flex-wrap gap-2">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={unreadOnly === value}
            onClick={() => {
              setUnreadOnly(value);
              setLimit(PAGE);
            }}
            className={`h-10 rounded-full border px-4 text-sm font-semibold ${unreadOnly === value ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-chip"}`}
          >
            {value ? t.notifications.unreadOnly : t.notifications.all}
          </button>
        ))}
      </div>

      {actionError !== null && <Alert tone="error">{errorMessage(actionError, t)}</Alert>}
      {error && !page ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
        </Alert>
      ) : !page ? (
        <PageLoader label={t.common.loading} />
      ) : page.items.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">{unreadOnly ? t.notifications.emptyUnread : t.notifications.empty}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line-soft">
            {page.items.map((item) => {
              const href = notificationHref(item);
              const { title, details } = notificationText(item, t);
              return (
                <li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      {href ? (
                        <button type="button" onClick={() => open(item, href)} className={`text-left text-base text-brand-ink hover:underline ${item.read_at ? "font-medium" : "font-bold"}`}>
                          {title}
                        </button>
                      ) : (
                        <span className={`text-base ${item.read_at ? "font-medium" : "font-bold"}`}>{title}</span>
                      )}
                      {!item.read_at && <Badge tone="info">{t.notifications.isNew}</Badge>}
                    </span>
                    {details && <span className="break-words text-sm text-ink-2">{details}</span>}
                    <time dateTime={item.created_at} className="text-[13px] text-muted">{formatDateTime(item.created_at, DEFAULT_TIMEZONE, intlLocale)}</time>
                  </div>
                  {!item.read_at && (
                    <Button variant="ghost" className="shrink-0" loading={busy === item.id} disabled={busy !== null} onClick={() => run(item.id, () => notificationsApi.markRead(item.id))}>
                      {t.notifications.markRead}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {page.items.length < page.total && limit < API_MAX && (
            <Button variant="secondary" className="w-fit" onClick={() => setLimit((n) => Math.min(API_MAX, n + PAGE))}>
              {fmt(t.notifications.more, { shown: page.items.length, total: page.total })}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense>
      <RequireAuth>
        <Notifications />
      </RequireAuth>
    </Suspense>
  );
}
