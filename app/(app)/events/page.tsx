"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, LinkButton, PageLoader, PlusIcon, StatusBadge } from "@/components/ui";
import { eventsApi } from "@/lib/api/endpoints";
import type { EventStatus, EventSummary } from "@/lib/api/types";
import { hasMonthNames } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { useOrganizerProfile } from "@/lib/useOrganizerProfile";

type Filter = "ALL" | EventStatus;
const FILTERS: Filter[] = ["ALL", "DRAFT", "PUBLISHED", "UNPUBLISHED", "CANCELLED", "COMPLETED"];

function dateParts(iso: string, timeZone: string, locale: string) {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
  return {
    day: part({ day: "2-digit" }),
    month: hasMonthNames(locale) ? part({ month: "short" }).replace(".", "") : part({ month: "2-digit" }),
    time: part(hasMonthNames(locale) ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}

export default function EventsPage() {
  const { t, intlLocale } = useI18n();
  const { profile, loading: profileLoading } = useOrganizerProfile();
  const { data, error, reload } = useApi<EventSummary[]>(() => eventsApi.listOwn(), []);
  const events = data ?? null;
  const [filter, setFilter] = useState<Filter>("ALL");

  const visible = (events ?? []).filter((e) => filter === "ALL" || e.status === filter);
  const count = (f: Filter) => (events ?? []).filter((e) => f === "ALL" || e.status === f).length;
  const needsProfile = !profileLoading && profile === null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[32px] font-bold tracking-tight">{t.dashboard.title}</h1>
        {!needsProfile && (
          <LinkButton href="/events/new" size="lg">
            <PlusIcon />
            {t.nav.newEvent}
          </LinkButton>
        )}
      </div>

      {needsProfile && (
        <Alert tone="info">
          {t.dashboard.needProfile}{" "}
          <Link href="/profile" className="font-semibold underline">
            {t.dashboard.setUpProfile}
          </Link>
        </Alert>
      )}

      {error ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">
            {t.common.retry}
          </button>
        </Alert>
      ) : events === null ? (
        <PageLoader label={t.common.loading} />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-brand-soft text-brand-ink">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <h2 className="text-[22px] font-bold">{t.dashboard.empty}</h2>
          <p className="max-w-[420px] text-[15px] leading-normal text-muted">{t.dashboard.emptyHint}</p>
          {!needsProfile && <LinkButton href="/events/new">{t.dashboard.createFirst}</LinkButton>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="group" aria-label={t.dashboard.filterLabel} className="flex flex-wrap gap-2">
            {FILTERS.filter((f) => f === "ALL" || count(f) > 0).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f)}
                  className={`h-10 rounded-full border px-4 text-sm font-semibold ${
                    active ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-chip"
                  }`}
                >
                  {f === "ALL" ? t.dashboard.filterAll : t.status[f]} <span className="opacity-70">{count(f)}</span>
                </button>
              );
            })}
          </div>

          <ul className="overflow-hidden rounded-2xl bg-surface">
            {visible.map((event) => {
              const d = dateParts(event.starts_at, event.timezone, intlLocale);
              const place = [event.venue_name, event.city].filter(Boolean).join(", ");
              return (
                <li key={event.id} className="border-b border-line-soft last:border-b-0">
                  <Link href={`/events/${event.id}`} className="flex flex-wrap items-center gap-5 px-6 py-4 hover:bg-[#fafafb]">
                    <div className="flex h-16 w-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-canvas">
                      <span className="text-[22px] font-bold leading-none">{d.day}</span>
                      <span className="mt-1 text-xs font-semibold uppercase text-muted">{d.month}</span>
                    </div>
                    <div className="flex min-w-0 flex-[999_1_280px] flex-col gap-1">
                      <span className="text-[17px] font-semibold">{event.title}</span>
                      <span className="text-sm text-muted">
                        {d.time}
                        {place && ` · ${place}`}
                      </span>
                    </div>
                    <div className="flex min-w-[110px] flex-col gap-0.5">
                      <span className="text-[13px] text-muted">{t.dashboard.columns.capacity}</span>
                      <span className="text-[15px] font-semibold">{event.capacity ?? "—"}</span>
                    </div>
                    <StatusBadge status={event.status} label={t.status[event.status]} />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a939e" strokeWidth="2" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
