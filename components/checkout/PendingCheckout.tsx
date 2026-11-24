"use client";

import { useEffect, useState } from "react";
import { Alert, Button, LinkButton } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { ordersApi } from "@/lib/api/endpoints";
import type { Order, PaymentOutcome } from "@/lib/api/types";
import { formatCountdown, retryHref, secondsLeft } from "@/lib/checkout";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";

/**
 * Payment step of an unpaid order: the reservation countdown and the demo
 * payment. No card or personal data is asked for, because nothing is charged.
 */
export function PendingCheckout({ order, onChanged }: { order: Order; onChanged: (failureCode: string | null) => void }) {
  const { t, intlLocale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<PaymentOutcome | null>(null);
  const [error, setError] = useState<unknown>(null);

  const left = secondsLeft(order.expires_at, now);
  const expired = left === 0;

  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      // Reading the order makes the server release the reservation.
      if (secondsLeft(order.expires_at, tick) === 0) onChanged(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [expired, order.expires_at, onChanged]);

  async function pay(outcome: PaymentOutcome) {
    setBusy(outcome);
    setError(null);
    try {
      const { payment_id } = await ordersApi.startPayment(order.id);
      const payment = await ordersApi.resolvePayment(payment_id, outcome);
      onChanged(payment.status === "FAILED" ? (payment.failure_code ?? "FAILED") : null);
    } catch (err) {
      // The order moved on without us (expired, cancelled, paid in another
      // tab): show its real state instead of a dead payment form.
      if (err instanceof ApiError && ["ORDER_NOT_PAYABLE", "ORDER_EXPIRED", "EVENT_CANCELLED"].includes(err.code)) onChanged(null);
      setError(err);
      setBusy(null);
    }
  }

  if (expired) {
    return (
      <section className="flex flex-col gap-4 rounded-[20px] bg-surface p-6 sm:p-8">
        <Alert tone="warning">{t.checkout.expired}</Alert>
        <LinkButton size="lg" href={retryHref(order)}>
          {t.checkout.retry}
        </LinkButton>
      </section>
    );
  }

  return (
    <section aria-labelledby="pay-h" className="flex flex-col gap-5 rounded-[20px] bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pay-h" className="text-xl font-bold">{t.checkout.payTitle}</h2>
        {/* role=timer is not announced every second; the text below covers screen readers. */}
        <span
          role="timer"
          aria-label={t.checkout.timeLeft}
          className={`rounded-full px-4 py-2 text-base font-bold tabular-nums ${left <= 60 ? "bg-danger-soft text-danger-ink" : "bg-warn-soft text-warn-ink"}`}
        >
          {formatCountdown(left)}
        </span>
      </div>
      <p className="text-sm text-muted">{t.checkout.reservedHint}</p>
      <Alert tone="info">{t.checkout.demoNotice}</Alert>
      {error !== null && <Alert tone="error">{errorMessage(error, t)}</Alert>}
      <Button size="lg" loading={busy === "success"} disabled={busy !== null} onClick={() => pay("success")}>
        {fmt(t.checkout.payDemo, { amount: formatMoney(order.total_amount, order.currency, intlLocale) })}
      </Button>
      <Button variant="secondary" loading={busy === "failed"} disabled={busy !== null} onClick={() => pay("failed")}>
        {t.checkout.failDemo}
      </Button>
    </section>
  );
}
