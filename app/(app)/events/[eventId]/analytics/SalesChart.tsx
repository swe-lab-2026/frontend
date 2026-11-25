"use client";

import { useState } from "react";
import { Alert, PageLoader } from "@/components/ui";
import { eventsApi } from "@/lib/api/endpoints";
import type { Event } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { type DayRange, rangeQuery, salesBuckets, type SalesBucket as Point, sumByBucket } from "@/lib/history";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { useApi } from "@/lib/useApi";

async function loadSeries(event: Event, range: DayRange, typeId: string | undefined): Promise<Point[]> {
  const buckets = salesBuckets(range, event.timezone, new Date());
  if (buckets.length === 0) return [];
  const period = { from: buckets[0].from, to: buckets[buckets.length - 1].to };
  const data = await eventsApi.analytics(event.id, { ...rangeQuery(period, event.timezone), ticket_type_id: typeId });
  return sumByBucket(buckets, data.sales_over_time);
}

const HEIGHT = 180;

export function SalesChart({ event, range, typeId, refresh }: { event: Event; range: DayRange; typeId?: string; refresh: number }) {
  const { t, intlLocale } = useI18n();
  const key = `${event.id}|${range.from}|${range.to}|${typeId ?? ""}|${refresh}`;
  const { data, error } = useApi(() => loadSeries(event, range, typeId).then((points) => ({ key, points })), [key]);
  const [hovered, setHovered] = useState<number | null>(null);

  if (error) return <Alert tone="error">{errorMessage(error, t)}</Alert>;
  // Never draw one filter's bars under another filter's heading.
  if (!data || data.key !== key) return <PageLoader label={t.common.loading} />;

  const { points } = data;
  const max = Math.max(...points.map((p) => Number(p.revenue)), 0);
  const day = (iso: string) => new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const label = (p: Point) => (p.from === p.to ? day(p.from) : `${day(p.from)}–${day(p.to)}`);
  const money = (value: string | number) => formatMoney(value, "KZT", intlLocale);
  const active = hovered === null ? null : points[hovered];
  const totalTickets = points.reduce((sum, p) => sum + p.tickets, 0);

  if (totalTickets === 0) return <p className="py-6 text-center text-[15px] text-muted">{t.analytics.noSales}</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="min-h-5 text-sm text-ink-2" aria-live="polite">
        {active ? `${label(active)}: ${money(active.revenue)} · ${fmt(t.analytics.ticketCount, { count: active.tickets })}` : t.analytics.chartHint}
      </p>
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted" style={{ height: HEIGHT }} aria-hidden="true">
          <span>{money(max)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-0.5 border-b border-line" style={{ height: HEIGHT }} onMouseLeave={() => setHovered(null)}>
            {points.map((p, i) => (
              <button
                key={p.from}
                type="button"
                aria-label={`${label(p)}: ${money(p.revenue)}, ${fmt(t.analytics.ticketCount, { count: p.tickets })}`}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onClick={() => setHovered(i)}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
              >
                <span
                  className={`w-full max-w-6 rounded-t ${hovered === i ? "bg-brand-hover" : "bg-[#197532]"}`}
                  style={{ height: max > 0 ? `${(Number(p.revenue) / max) * 100}%` : 0 }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden="true">
            <span>{label(points[0])}</span>
            {points.length > 1 && <span>{label(points[points.length - 1])}</span>}
          </div>
        </div>
      </div>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-semibold text-brand-ink">{t.analytics.asTable}</summary>
        <table className="mt-2 w-full max-w-[420px] border-collapse tabular-nums">
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="py-1.5 font-semibold">{t.analytics.period}</th>
              <th scope="col" className="py-1.5 text-right font-semibold">{t.inventory.sold}</th>
              <th scope="col" className="py-1.5 text-right font-semibold">{t.analytics.gross}</th>
            </tr>
          </thead>
          <tbody>
            {points.filter((p) => p.tickets > 0).map((p) => (
              <tr key={p.from} className="border-t border-line-soft">
                <td className="py-1.5">{label(p)}</td>
                <td className="py-1.5 text-right">{p.tickets}</td>
                <td className="py-1.5 text-right">{money(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
