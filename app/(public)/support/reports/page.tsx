"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { RequireAuth } from "@/components/support/RequireAuth";
import { Alert, BackLink, Badge, Button, Card, CardHeader, PageLoader } from "@/components/ui";
import { catalogApi, usersApi } from "@/lib/api/endpoints";
import type { EventReport, Page } from "@/lib/api/types";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { reportTone } from "@/lib/support";
import { useApi } from "@/lib/useApi";

const PAGE = 20;
type Data = { page: Page<EventReport>; titles: Record<string, string> };

/** Reports carry no event title. A hidden event simply has none. */
async function loadReports(limit: number): Promise<Data> {
  const page = await usersApi.reports(limit, 0);
  const ids = [...new Set(page.items.map((item) => item.event_id))];
  const events = await Promise.allSettled(ids.map((id) => catalogApi.event(id)));
  const titles: Record<string, string> = {};
  events.forEach((result) => {
    if (result.status === "fulfilled") titles[result.value.id] = result.value.title;
  });
  return { page, titles };
}

function MyReports() {
  const { t, intlLocale } = useI18n();
  const [limit, setLimit] = useState(PAGE);
  const { data, error, reload } = useApi<Data>(() => loadReports(limit), [limit]);

  return (
    <>
      <BackLink href="/support">{t.support.title}</BackLink>
      <Card aria-labelledby="reports-h" className="mx-auto w-full max-w-[880px]">
        <title>{`${t.reports.mine} — BiletFlow`}</title>
        <CardHeader id="reports-h" title={t.reports.mine} description={t.reports.mineHint} />
        {error && !data ? (
          <Alert tone="error">
            {errorMessage(error, t)}{" "}
            <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
          </Alert>
        ) : !data ? (
          <PageLoader label={t.common.loading} />
        ) : data.page.items.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-muted">{t.reports.empty}</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-line-soft">
              {data.page.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {data.titles[item.event_id] ? (
                      <Link href={`/catalog/${item.event_id}`} className="w-fit break-words text-base font-semibold text-brand-ink hover:underline">
                        {data.titles[item.event_id]}
                      </Link>
                    ) : (
                      <span className="text-base font-semibold">{t.order.eventHidden}</span>
                    )}
                    <span className="break-words text-sm text-ink-2">
                      {[(t.reports.reasons as Record<string, string>)[item.reason] ?? item.reason, item.details].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-[13px] text-muted">{formatDateTime(item.created_at, DEFAULT_TIMEZONE, intlLocale)}</span>
                  </div>
                  <Badge tone={reportTone(item.status)}>{(t.reports.status as Record<string, string>)[item.status] ?? item.status}</Badge>
                </li>
              ))}
            </ul>
            {data.page.items.length < data.page.total && limit < 100 && (
              <Button variant="secondary" className="w-fit" onClick={() => setLimit((n) => Math.min(100, n + PAGE))}>
                {fmt(t.notifications.more, { shown: data.page.items.length, total: data.page.total })}
              </Button>
            )}
          </>
        )}
      </Card>
    </>
  );
}

export default function MyReportsPage() {
  return (
    <Suspense>
      <RequireAuth>
        <MyReports />
      </RequireAuth>
    </Suspense>
  );
}
