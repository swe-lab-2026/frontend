"use client";

import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";

type Props = {
  currency: string;
  subtotal: string;
  discount: string;
  fee: string;
  total: string;
  promoCode?: string | null;
};

/** Subtotal, discount, processing fee and total, exactly as the server calculated them. */
export function PriceSummary({ currency, subtotal, discount, fee, total, promoCode }: Props) {
  const { t, intlLocale } = useI18n();
  const money = (amount: string) => formatMoney(amount, currency, intlLocale);

  return (
    <dl className="flex flex-col gap-2 text-[15px]">
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{t.checkout.subtotal}</dt>
        <dd>{money(subtotal)}</dd>
      </div>
      {Number(discount) > 0 && (
        <div className="flex justify-between gap-3 text-brand-ink">
          <dt>{promoCode ? fmt(t.checkout.discountWithCode, { code: promoCode }) : t.checkout.discount}</dt>
          <dd className="font-semibold">−{money(discount)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <dt className="text-muted">{t.checkout.fee}</dt>
        <dd>{money(fee)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-line-soft pt-3 text-lg font-bold">
        <dt>{t.attend.total}</dt>
        <dd>{money(total)}</dd>
      </div>
    </dl>
  );
}
