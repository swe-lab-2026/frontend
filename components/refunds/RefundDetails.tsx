"use client";

import type { Refund } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";

/** The refund of one order, as the server recorded it. */
export function RefundDetails({ refund, timezone }: { refund: Refund; timezone: string }) {
  const { t, intlLocale } = useI18n();
  const label = (map: object, value: string) => (map as Record<string, string>)[value] ?? value;
  const rows = [
    [t.refunds.amount, formatMoney(refund.amount, refund.currency, intlLocale)],
    [t.refunds.statusLabel, label(t.refunds.status, refund.status)],
    [t.refunds.kindLabel, label(t.refunds.kind, refund.kind)],
    [t.refunds.date, formatDateTime(refund.completed_at ?? refund.created_at, timezone, intlLocale)],
  ];
  return (
    <section aria-labelledby="refund-h" className="flex flex-col gap-4 rounded-[20px] bg-surface p-6 sm:p-8">
      <h2 id="refund-h" className="text-xl font-bold">{t.refunds.details}</h2>
      <dl className="flex flex-col gap-2 text-[15px]">
        {rows.map(([name, value]) => (
          <div key={name} className="flex justify-between gap-3">
            <dt className="text-muted">{name}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {refund.is_simulated && <p className="text-[13px] text-muted">{t.refunds.demo}</p>}
    </section>
  );
}
