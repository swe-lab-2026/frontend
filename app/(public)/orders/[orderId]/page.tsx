"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TicketCard } from "@/components/tickets/TicketCard";
import { Alert, BackLink, Badge, Button, CheckIcon, LinkButton, PageLoader } from "@/components/ui";
import { catalogApi, ordersApi, ticketsApi } from "@/lib/api/endpoints";
import type { Event, Order } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { canCancelOrder, isOrderConfirmed, orderTone } from "@/lib/tickets";
import { useApi } from "@/lib/useApi";

export default function OrderPage() {
  const { status } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();

  // Orders are private to their buyer: sign in first, then come back here.
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  }, [status, router, orderId]);

  if (status !== "authenticated") return <PageLoader label={t.common.loading} />;
  return <OrderDetails orderId={orderId} />;
}

function OrderDetails({ orderId }: { orderId: string }) {
  const { t, intlLocale } = useI18n();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const { data, error, reload } = useApi<[Order, Event]>(
    async () => {
      const order = await ordersApi.get(orderId);
      // The backend attaches tickets only to PAID/CONFIRMED orders, so for a
      // cancelled or refunded order read them from the user's ticket list to
      // still show each ticket's CANCELLED/REFUNDED status.
      if (order.tickets.length === 0 && !isOrderConfirmed(order.status) && order.status !== "PENDING") {
        const all = await ticketsApi.list().catch(() => []);
        order.tickets = all.filter((ticket) => ticket.order_id === order.id);
      }
      return [order, await catalogApi.event(order.event_id)];
    },
    [orderId],
  );

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

  const [order, event] = data;
  const cancellable = canCancelOrder(order) && new Date(event.starts_at) > new Date();

  async function handleCancel() {
    if (!window.confirm(order.status === "PENDING" ? t.order.confirmCancelPending : t.order.confirmCancel)) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await ordersApi.cancel(order.id);
      reload();
    } catch (err) {
      setCancelError(err);
    } finally {
      setCancelling(false);
    }
  }
  const money = (amount: string) => (Number(amount) === 0 ? t.tickets.free : formatMoney(amount, order.currency, intlLocale));
  const statusLabel = (t.order.status as Record<string, string>)[order.status] ?? order.status;
  const paid = isOrderConfirmed(order.status);
  const pending = order.status === "PENDING";
  // Cancelled / expired / refunded orders explain themselves in words, not just a badge colour.
  const statusHelp = (t.order.statusHelp as Record<string, string>)[order.status];
  const place = [event.venue_name, event.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <BackLink href="/orders">{t.orders.title}</BackLink>
      <title>{`${t.order.number} · ${event.title} — BiletFlow`}</title>
      <section className="flex flex-col items-center gap-3 rounded-[20px] bg-surface px-6 py-10 text-center">
        {paid && (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <CheckIcon size={32} />
          </span>
        )}
        <h1 className="text-[28px] font-bold tracking-tight">
          {paid
            ? t.order.confirmedTitle
            : pending
              ? t.order.pendingTitle
              : order.status === "PARTIALLY_REFUNDED"
                ? t.order.partialTitle
                : t.order.inactiveTitle}
        </h1>
        {statusHelp && <p className="max-w-[440px] text-[15px] leading-normal text-muted">{statusHelp}</p>}
        {paid && <p className="max-w-[440px] text-[15px] leading-normal text-muted">{t.order.confirmedText}</p>}
        {pending && order.expires_at && (
          <p className="text-[15px] text-muted">{fmt(t.order.pendingText, { date: formatDateTime(order.expires_at, event.timezone, intlLocale) })}</p>
        )}
      </section>

      <section className="flex flex-col gap-5 rounded-[20px] bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-muted">{t.order.number}</span>
            <span className="font-mono text-sm">#{order.order_number}</span>
          </div>
          <Badge tone={orderTone(order.status)}>{statusLabel}</Badge>
        </div>

        <div className="flex flex-col gap-1 border-t border-line-soft pt-5">
          <span className="text-[13px] text-muted">{t.order.event}</span>
          <span className="text-lg font-semibold">{event.title}</span>
          <span className="text-sm text-muted">
            {formatDateTime(event.starts_at, event.timezone, intlLocale)}
            {place && ` · ${place}`}
          </span>
        </div>

        <div className="flex flex-col gap-3 border-t border-line-soft pt-5">
          <span className="text-[13px] text-muted">{t.order.tickets}</span>
          <ul className="flex flex-col gap-2">
            {order.items.map((item) => (
              <li key={`${item.ticket_type_id}-${item.final_price}`} className="flex justify-between gap-3 text-[15px]">
                <span>
                  {item.ticket_type_name} × {item.quantity}
                </span>
                <span className="font-semibold">{money(String(Number(item.final_price) * item.quantity))}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line-soft pt-3 text-base font-bold">
            <span>{t.order.total}</span>
            <span>{money(order.total_amount)}</span>
          </div>
        </div>

      </section>

      {/* Cancelled/expired orders with no tickets are already explained by statusHelp above. */}
      {(order.tickets.length > 0 || paid || pending) && (
        <section aria-labelledby="order-tickets" className="flex flex-col gap-3">
          <h2 id="order-tickets" className="text-xl font-bold tracking-tight">
            {t.ticket.heading}
          </h2>
          {order.tickets.length > 0 ? (
            order.tickets.map((ticket) => <TicketCard key={ticket.public_id} ticket={ticket} />)
          ) : (
            <Alert tone="info">{paid ? t.ticket.noneYet : t.ticket.notIssued}</Alert>
          )}
        </section>
      )}

      {cancelError !== null && <Alert tone="error">{errorMessage(cancelError, t)}</Alert>}

      <div className="flex flex-wrap justify-center gap-3">
        {cancellable && (
          <Button variant="danger-outline" onClick={handleCancel} loading={cancelling}>
            {order.status === "PENDING" ? t.order.cancelPending : t.order.cancel}
          </Button>
        )}
        <LinkButton variant="secondary" href={`/catalog/${event.id}`}>
          {t.order.viewEvent}
        </LinkButton>
        <LinkButton href="/catalog">{t.order.browseMore}</LinkButton>
      </div>
    </div>
  );
}
