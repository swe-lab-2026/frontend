"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Alert, BackLink, Button, PageLoader, StatusBadge } from "@/components/ui";
import { eventsApi } from "@/lib/api/endpoints";
import type { Event } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { EventContext } from "./EventContext";

export default function EventLayout({ children }: LayoutProps<"/">) {
  const { t, intlLocale } = useI18n();
  const { eventId } = useParams<{ eventId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const { data: event, error: loadError, reload: load, setData: setEvent } = useApi<Event>(() => eventsApi.get(eventId), [eventId]);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const updateEvent = useCallback((next: Event) => {
    setEvent(next);
    setVersion((v) => v + 1);
  }, [setEvent]);
  const contextValue = useMemo(
    () => (event ? { event, setEvent: updateEvent, version, invalidate } : null),
    [event, updateEvent, version, invalidate],
  );

  if (loadError && !event) {
    return (
      <>
        <BackLink href="/events">{t.nav.dashboard}</BackLink>
        <Alert tone="error">
          {errorMessage(loadError, t)}{" "}
          <button type="button" onClick={load} className="font-semibold underline">
            {t.common.retry}
          </button>
        </Alert>
      </>
    );
  }
  if (!event || !contextValue) return <PageLoader label={t.common.loading} />;

  async function runAction(name: string, action: () => Promise<Event | void>, successText: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(name);
    setNotice(null);
    try {
      const result = await action();
      if (result) updateEvent(result);
      setNotice({ tone: "success", text: successText });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  }

  const id = event.id;
  const canPublish = event.status === "DRAFT" || event.status === "UNPUBLISHED";
  const canUnpublish = event.status === "PUBLISHED";
  const base = `/events/${id}`;
  const tabs = [
    { href: base, label: t.event.tabs.overview },
    { href: `${base}/edit`, label: t.event.tabs.details },
    { href: `${base}/tickets`, label: t.event.tabs.tickets },
  ];
  const place = [event.venue_name, event.city].filter(Boolean).join(", ");
  const cover = event.images[0];

  return (
    <EventContext.Provider value={contextValue}>
      <BackLink href="/events">{t.nav.dashboard}</BackLink>

      <section className="flex flex-wrap items-center gap-6 rounded-[20px] bg-surface p-6">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- organizer-supplied URLs from arbitrary hosts
          <img src={cover.object_key} alt={cover.alt_text ?? ""} className="h-[132px] w-[220px] shrink-0 rounded-[14px] bg-[#e9ecef] object-cover" />
        ) : (
          <div className="flex h-[132px] w-[220px] shrink-0 items-center justify-center rounded-[14px] bg-[#e9ecef] text-[13px] text-muted">
            {t.event.noCover}
          </div>
        )}
        <div className="flex min-w-0 flex-[999_1_320px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={event.status} label={t.status[event.status]} />
            <span className="text-[13px] text-muted">
              {t.visibility[event.visibility]}
              {event.category && ` · ${(t.categories as Record<string, string>)[event.category] ?? event.category}`}
            </span>
          </div>
          <h1 className="text-[30px] font-bold tracking-tight">{event.title}</h1>
          <div className="flex flex-wrap gap-5 text-[15px] text-ink-2">
            <span>
              {formatDateTime(event.starts_at, event.timezone, intlLocale)} — {formatDateTime(event.ends_at, event.timezone, intlLocale)}
            </span>
            {place && <span>{place}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canPublish && (
            <Button
              size="lg"
              loading={busy === "publish"}
              onClick={() => runAction("publish", () => eventsApi.publish(id), t.event.actions.published)}
            >
              {t.event.actions.publish}
            </Button>
          )}
          {canUnpublish && (
            <Button
              variant="secondary"
              size="lg"
              loading={busy === "unpublish"}
              onClick={() => runAction("unpublish", () => eventsApi.unpublish(id), t.event.actions.unpublished)}
            >
              {t.event.actions.unpublish}
            </Button>
          )}
          <Button
            variant="secondary"
            size="lg"
            loading={busy === "duplicate"}
            onClick={async () => {
              setBusy("duplicate");
              try {
                const copy = await eventsApi.duplicate(id);
                router.push(`/events/${copy.id}?duplicated=1`);
              } catch (error) {
                setNotice({ tone: "error", text: errorMessage(error, t) });
                setBusy(null);
              }
            }}
          >
            {t.event.actions.duplicate}
          </Button>
        </div>
      </section>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <nav aria-label={t.event.tabsLabel} className="flex flex-wrap gap-1 border-b border-[#e1e4e8]">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "-mb-px border-b-2 border-brand px-4 py-3 text-[15px] font-semibold text-ink"
                  : "px-4 py-3 text-[15px] font-medium text-muted hover:text-ink"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}

      {event.status !== "CANCELLED" && event.status !== "COMPLETED" && (
        <section aria-labelledby="danger-h" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#f6d3cf] bg-surface p-6">
          <div className="flex flex-col gap-1">
            <h2 id="danger-h" className="text-base font-bold text-danger-ink">{t.event.dangerZone}</h2>
            <p className="text-sm text-muted">{t.event.dangerHint}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {event.status === "DRAFT" && (
              <Button
                variant="danger-outline"
                loading={busy === "delete"}
                onClick={async () => {
                  if (!window.confirm(t.event.actions.confirmDelete)) return;
                  setBusy("delete");
                  try {
                    await eventsApi.remove(id);
                    router.replace("/events");
                  } catch (error) {
                    setNotice({ tone: "error", text: errorMessage(error, t) });
                    setBusy(null);
                  }
                }}
              >
                {t.event.actions.delete}
              </Button>
            )}
            <Button
              variant="danger"
              loading={busy === "cancel"}
              onClick={() => runAction("cancel", () => eventsApi.cancel(id), t.event.actions.cancelled, t.event.actions.confirmCancel)}
            >
              {t.event.actions.cancel}
            </Button>
          </div>
        </section>
      )}
    </EventContext.Provider>
  );
}
