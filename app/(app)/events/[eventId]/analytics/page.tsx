"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageLoader, Select } from "@/components/ui";
import { eventsApi, ticketTypesApi } from "@/lib/api/endpoints";
import type { CampaignMetrics, EventAnalytics, EventSummary, TicketType, TicketTypeMetrics } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { type DayRange, isBadRange, rangeQuery } from "@/lib/history";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";
import { SalesChart } from "./SalesChart";

// Validated pair (CVD + contrast) on white; unsold stock is the neutral track.
const SOLD = "#197532";
const RESERVED = "#2a78d6";

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-surface p-5">
      <span className="text-sm text-muted">{label}</span>
      <span className="break-words text-[26px] font-bold tracking-tight">{value}</span>
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </div>
  );
}

function TicketTypeChart({ rows }: { rows: TicketTypeMetrics[] }) {
  const { t, intlLocale } = useI18n();
  const max = Math.max(1, ...rows.map((row) => row.capacity));
  const width = (value: number) => `${(value / max) * 100}%`;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-4 text-[13px] text-ink-2">
        {[
          [t.inventory.sold, SOLD],
          [t.inventory.reserved, RESERVED],
          [t.inventory.available, "#e1e4e8"],
        ].map(([label, color]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: color }} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const summary = `${row.name}: ${t.inventory.sold} ${row.sold_tickets}, ${t.inventory.reserved} ${row.reserved_tickets}, ${t.inventory.available} ${row.remaining_tickets}`;
          return (
            <li key={row.ticket_type_id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  {row.name}
                  {row.is_hidden && <Badge>{t.tickets.hiddenBadge}</Badge>}
                </span>
                <span className="tabular-nums text-muted">
                  {fmt(t.analytics.soldOf, { sold: row.sold_tickets, capacity: row.capacity })} ·{" "}
                  {fmt(t.analytics.inPeriod, { count: row.period_tickets_sold, amount: formatMoney(row.period_revenue, row.currency, intlLocale) })}
                </span>
              </div>
              {/* All bars share one scale, so their lengths compare across types. */}
              <div role="img" aria-label={summary} title={summary} className="flex h-5 w-full gap-0.5">
                {row.sold_tickets > 0 && <span className="h-full rounded-r" style={{ width: width(row.sold_tickets), background: SOLD }} />}
                {row.reserved_tickets > 0 && <span className="h-full rounded-r" style={{ width: width(row.reserved_tickets), background: RESERVED }} />}
                {row.remaining_tickets > 0 && <span className="h-full rounded-r bg-[#e1e4e8]" style={{ width: width(row.remaining_tickets) }} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CampaignTable({ rows }: { rows: CampaignMetrics[] }) {
  const { t, intlLocale } = useI18n();
  return (
    <div className="overflow-x-auto rounded-xl border border-line-soft">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#f7f8f9] text-left text-muted">
            <th scope="col" className="px-4 py-3 font-semibold">{t.campaigns.name}</th>
            {[t.campaigns.redeemed, t.campaigns.reserved, t.campaigns.orders, t.campaigns.tickets, t.campaigns.discountTotal, t.campaigns.revenue].map((label) => (
              <th key={label} scope="col" className="px-3 py-3 text-right font-semibold">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // Promo discounts only exist in KZT (SRS 4.14), so there is one sales row.
            const sales = row.sales.find((item) => item.currency === "KZT");
            return (
              <tr key={row.campaign_id} className="border-t border-line-soft tabular-nums">
                <th scope="row" className="px-4 py-3.5 text-left">
                  <span className="block text-[15px] font-semibold">{row.name}</span>
                  <span className="font-mono text-[13px] font-normal text-muted">{row.promo_code}</span>
                </th>
                <td className="px-3 py-3.5 text-right">{row.successful_redemptions}</td>
                <td className="px-3 py-3.5 text-right">{row.reserved_redemptions}</td>
                <td className="px-3 py-3.5 text-right">{sales?.orders ?? 0}</td>
                <td className="px-3 py-3.5 text-right">{sales?.tickets_sold ?? 0}</td>
                <td className="px-3 py-3.5 text-right">{formatMoney(sales?.discounts ?? 0, "KZT", intlLocale)}</td>
                <td className="px-3 py-3.5 text-right font-bold">{formatMoney(sales?.revenue ?? 0, "KZT", intlLocale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t, intlLocale } = useI18n();
  const { event, version } = useEventContext();
  const router = useRouter();
  const [typeId, setTypeId] = useState("all");
  const [range, setRange] = useState<DayRange>({ from: "", to: "" });
  const [refresh, setRefresh] = useState(0);

  const badRange = isBadRange(range);
  const filterKey = `${event.id}|${typeId}|${range.from}|${range.to}`;
  const { data: result, error, reload } = useApi<{ key: string; value: EventAnalytics } | null>(
    () =>
      badRange
        ? Promise.resolve(null)
        : eventsApi
            .analytics(event.id, { ...rangeQuery(range, event.timezone), ticket_type_id: typeId === "all" ? undefined : typeId })
            .then((value) => ({ key: filterKey, value })),
    [filterKey, version, refresh],
  );
  // Filter choices only: a failure here must not hide the metrics.
  const { data: options } = useApi<[TicketType[], EventSummary[]]>(
    () => Promise.all([ticketTypesApi.list(event.id).catch(() => []), eventsApi.listOwn().catch(() => [])]),
    [event.id, version],
  );

  // An organizer opening someone else's event gets the backend's 403 here,
  // and nothing else is rendered.
  if (error && !result) {
    return (
      <Alert tone="error">
        {errorMessage(error, t)}{" "}
        <button type="button" onClick={reload} className="font-semibold underline">
          {t.common.retry}
        </button>
      </Alert>
    );
  }
  if (result === undefined) return <PageLoader label={t.common.loading} />;

  const [types, events] = options ?? [[], []];
  // Only show numbers that belong to the filters on screen.
  const data = !badRange && result?.key === filterKey ? result.value : null;
  const money = (amount: string) => formatMoney(amount, "KZT", intlLocale);
  const percent = (part: number, whole: number) =>
    whole === 0 ? "—" : new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 1 }).format(part / whole);
  const sales = data?.sales.find((row) => row.currency === "KZT");
  const ended = new Date(event.ends_at) <= new Date();
  const filtered = typeId !== "all" || range.from !== "" || range.to !== "";

  return (
    <>
      <title>{`${t.analytics.tab} · ${event.title} — BiletFlow`}</title>

      <div className="flex flex-wrap items-end gap-4">
        <Field label={t.analytics.event} className="min-w-0 flex-[1_1_220px] sm:max-w-[320px]">
          {(props) => (
            <Select {...props} value={event.id} onChange={(e) => router.push(`/events/${e.target.value}/analytics`)}>
              {!events.some((e) => e.id === event.id) && <option value={event.id}>{event.title}</option>}
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.inventory.ticketType} className="min-w-0 flex-[1_1_180px] sm:max-w-[240px]">
          {(props) => (
            <Select {...props} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="all">{t.analytics.allTypes}</option>
              {types.map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.history.from} className="flex-[1_1_150px] sm:max-w-[180px]">
          {(props) => <Input {...props} type="date" value={range.from} onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))} />}
        </Field>
        <Field label={t.history.to} error={badRange ? t.history.badRange : undefined} className="flex-[1_1_150px] sm:max-w-[180px]">
          {(props) => <Input {...props} type="date" value={range.to} onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))} />}
        </Field>
        <Button variant="secondary" className="h-12" onClick={() => setRefresh((n) => n + 1)}>{t.inventory.refresh}</Button>
        {filtered && (
          <Button variant="ghost" className="h-12" onClick={() => { setTypeId("all"); setRange({ from: "", to: "" }); }}>{t.history.reset}</Button>
        )}
      </div>
      <p className="text-[13px] text-muted">{t.analytics.filterNote}</p>
      {Boolean(error) && <Alert tone="error">{errorMessage(error, t)}</Alert>}

      {badRange ? null : !data ? (
        error ? null : <PageLoader label={t.common.loading} />
      ) : data.ticket_types.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-[15px] text-muted">
            {t.event.noTicketTypes}{" "}
            <Link href={`/events/${event.id}/tickets`} className="font-semibold text-brand-ink hover:underline">{t.tickets.add}</Link>
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t.analytics.capacity} value={data.capacity.total_capacity} />
            <Tile label={t.analytics.sold} value={data.capacity.sold_tickets} />
            <Tile
              label={t.analytics.remaining}
              value={data.capacity.remaining_tickets}
              hint={data.capacity.reserved_tickets > 0 ? fmt(t.analytics.inCheckout, { count: data.capacity.reserved_tickets }) : undefined}
            />
            <Tile label={t.analytics.soldPercent} value={percent(data.capacity.sold_tickets, data.capacity.total_capacity)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile label={t.analytics.gross} value={money(sales?.gross_ticket_sales ?? "0")} hint={fmt(t.analytics.ticketCount, { count: sales?.tickets_sold ?? 0 })} />
            <Tile label={t.analytics.discounts} value={money(sales?.discounts ?? "0")} />
            {/* Fees belong to whole orders, so there are none to show for one ticket type. */}
            <Tile
              label={t.analytics.fees}
              value={typeId !== "all" ? "—" : money(sales?.fees ?? "0")}
              hint={typeId !== "all" ? t.analytics.feesPerOrder : t.analytics.feesHint}
            />
            <Tile label={t.analytics.refunds} value={money(sales?.refunds ?? "0")} hint={fmt(t.analytics.refundCount, { count: sales?.refund_count ?? 0 })} />
            <Tile
              label={t.analytics.net}
              value={money(sales?.net_revenue ?? "0")}
              hint={sales?.fees ? t.analytics.netWithFees : t.analytics.netNoFees}
            />
            <Tile
              label={t.analytics.payout}
              value={typeId !== "all" ? "—" : money(sales?.estimated_payout ?? "0")}
              hint={typeId !== "all" ? t.analytics.payoutAllTypes : t.analytics.payoutHint}
            />
          </div>

          <Card aria-labelledby="time-h">
            <CardHeader id="time-h" title={t.analytics.overTime} description={range.from || range.to ? t.analytics.overTimeRange : t.analytics.overTimeDefault} />
            <SalesChart event={event} range={range} typeId={typeId === "all" ? undefined : typeId} refresh={refresh} />
          </Card>

          <Card aria-labelledby="types-h">
            <CardHeader id="types-h" title={t.analytics.byType} />
            <TicketTypeChart rows={data.ticket_types} />
          </Card>

          <Card aria-labelledby="attendance-h">
            <CardHeader id="attendance-h" title={t.analytics.attendance} description={ended ? t.analytics.attendanceFinal : t.analytics.attendanceLive} />
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                [t.analytics.checkedIn, data.attendance.checked_in],
                [ended ? t.analytics.absent : t.analytics.notYet, data.attendance.eligible_tickets - data.attendance.checked_in],
                [t.analytics.checkInRate, percent(data.attendance.checked_in, data.attendance.eligible_tickets)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 rounded-xl bg-canvas p-4">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="text-2xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            {data.attendance.cancelled_tickets + data.attendance.refunded_tickets > 0 && (
              <p className="text-[13px] text-muted">
                {fmt(t.analytics.invalidated, { cancelled: data.attendance.cancelled_tickets, refunded: data.attendance.refunded_tickets })}
              </p>
            )}
          </Card>

          <Card aria-labelledby="camp-h">
            <CardHeader id="camp-h" title={t.campaigns.performance} description={t.analytics.campaignsNote} />
            {data.campaigns.length === 0 ? (
              <p className="py-4 text-center text-[15px] text-muted">{t.campaigns.empty}</p>
            ) : (
              <CampaignTable rows={data.campaigns} />
            )}
          </Card>
        </>
      )}
    </>
  );
}
