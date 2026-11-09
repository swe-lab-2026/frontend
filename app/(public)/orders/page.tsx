"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, Badge, LinkButton, PageLoader } from "@/components/ui";
import { catalogApi, ordersApi } from "@/lib/api/endpoints";
import type { Order } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { orderEventTitle, orderTone, ticketCount } from "@/lib/tickets";
import { useApi } from "@/lib/useApi";

export default function OrdersPage() {
  const { status } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent("/orders")}`);
  }, [status, router]);

  if (status !== "authenticated") return <PageLoader label={t.common.loading} />;
  return <OrderHistory />;
}

type Row = { order: Order; title: string | null; timezone: string };

/**
 * Pending/expired orders have no tickets to read the event title from, so
 * those events are looked up once each. A failed lookup only hides the title.
 */
async function loadOrders(): Promise<Row[]> {
  const orders = await ordersApi.list();
  const missing = [...new Set(orders.filter((o) => !orderEventTitle(o)).map((o) => o.event_id))];
  const events = new Map<string, { title: string; timezone: string }>();
  const results = await Promise.allSettled(missing.map((id) => catalogApi.event(id)));
  results.forEach((result, i) => {
    if (result.status === "fulfilled") events.set(missing[i], result.value);
  });
  return orders.map((order) => {
    const ticket = order.tickets[0];
    const event = events.get(order.event_id);
    return {
      order,
      title: ticket?.event_title ?? event?.title ?? null,
      timezone: ticket?.timezone ?? event?.timezone ?? "Asia/Almaty",
    };
  });
}

function OrderHistory() {
  const { t, intlLocale } = useI18n();
  const { data, error, reload } = useApi(loadOrders, []);

  if (error && !data) {
    return (
      <Alert tone="error">
        {errorMessage(error, t)}{" "}
        <button type="button" onClick={reload} className="font-semibold underline">
          {t.common.retry}
        </button>
      </Alert>
    );
  }
  if (!data) return <PageLoader label={t.common.loading} />;

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
      <title>{`${t.orders.title} — BiletFlow`}</title>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-tight">{t.orders.title}</h1>
        <p className="text-[15px] text-muted">{t.orders.subtitle}</p>
      </div>

      {data.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-[20px] bg-surface px-6 py-12 text-center">
          <p className="text-[15px] text-muted">{t.orders.empty}</p>
          <LinkButton href="/catalog">{t.order.browseMore}</LinkButton>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map(({ order, title, timezone }) => {
            const statusLabel = (t.order.status as Record<string, string>)[order.status] ?? order.status;
            const total = Number(order.total_amount) === 0 ? t.tickets.free : formatMoney(order.total_amount, order.currency, intlLocale);
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-3 rounded-[20px] bg-surface p-5 transition-colors hover:bg-canvas sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-lg font-semibold">{title ?? t.order.event}</span>
                    <span className="text-sm text-muted">
                      {fmt(t.orders.summary, {
                        number: order.order_number,
                        date: formatDateTime(order.created_at, timezone, intlLocale),
                        count: ticketCount(order),
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{total}</span>
                    <Badge tone={orderTone(order.status)}>{statusLabel}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
