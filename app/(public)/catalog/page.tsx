"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Input, PageLoader } from "@/components/ui";
import { catalogApi } from "@/lib/api/endpoints";
import type { EventSummary } from "@/lib/api/types";
import { dateParts } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";

export default function CatalogPage() {
  const { t, intlLocale } = useI18n();
  // The backend catalog also returns published events that already ended.
  const { data, error, reload } = useApi<EventSummary[]>(
    () => catalogApi.list().then((events) => events.filter((e) => new Date(e.ends_at) > new Date())),
    [],
  );
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = (data ?? []).filter((e) =>
    !needle || [e.title, e.venue_name, e.city].some((field) => field?.toLowerCase().includes(needle)),
  );

  return (
    <>
      <title>{`${t.catalog.title} — BiletFlow`}</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold tracking-tight">{t.catalog.title}</h1>
        <p className="text-[15px] text-muted">{t.catalog.subtitle}</p>
      </div>

      {error ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">
            {t.common.retry}
          </button>
        </Alert>
      ) : !data ? (
        <PageLoader label={t.common.loading} />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center">
          <h2 className="text-[22px] font-bold">{t.catalog.empty}</h2>
          <p className="max-w-[420px] text-[15px] text-muted">{t.catalog.emptyHint}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="max-w-[420px]">
            <span className="sr-only">{t.catalog.search}</span>
            <Input
              type="search"
              placeholder={t.catalog.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-field bg-surface px-3.5 text-base placeholder:text-muted"
            />
          </label>

          {visible.length === 0 ? (
            <p className="rounded-2xl bg-surface px-6 py-10 text-center text-[15px] text-muted">{t.catalog.noMatches}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((event) => {
                const d = dateParts(event.starts_at, event.timezone, intlLocale);
                const place = [event.venue_name, event.city].filter(Boolean).join(", ");
                return (
                  <li key={event.id}>
                    <Link
                      href={`/catalog/${event.id}`}
                      className="flex h-full gap-4 rounded-2xl bg-surface p-5 transition-shadow hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
                    >
                      <div className="flex h-16 w-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                        <span className="text-[22px] font-bold leading-none">{d.day}</span>
                        <span className="mt-1 text-xs font-semibold uppercase">{d.month}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[17px] font-semibold leading-snug">{event.title}</span>
                        <span className="text-sm text-muted">{d.time}</span>
                        {place && <span className="text-sm text-muted">{place}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
