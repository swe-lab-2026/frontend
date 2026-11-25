"use client";

import type { Campaign, CampaignAnalytics } from "@/lib/api/types";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";

/** Campaign results exactly as aggregated by the backend (no client maths). */
export function CampaignPerformance({ campaigns, analytics }: { campaigns: Campaign[]; analytics: CampaignAnalytics[] }) {
  const { t, intlLocale } = useI18n();
  const names = new Map(campaigns.map((c) => [c.id, c.name]));
  const columns = [t.campaigns.redeemed, t.campaigns.reserved, t.campaigns.discountTotal, t.campaigns.orders, t.campaigns.gross, t.campaigns.reversed, t.campaigns.net];

  return (
    <div className="relative overflow-x-auto rounded-xl border border-line-soft">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#f7f8f9] text-left text-muted">
            <th scope="col" className="px-4 py-3 font-semibold">{t.campaigns.name}</th>
            {columns.map((label) => (
              <th key={label} scope="col" className="px-3 py-3 text-right font-semibold">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analytics.map((row) => {
            const money = (amount: string) => formatMoney(amount, row.currency, intlLocale);
            return (
              <tr key={row.campaign_id} className="border-t border-line-soft tabular-nums">
                <th scope="row" className="px-4 py-3.5 text-left">
                  <span className="block text-[15px] font-semibold">{names.get(row.campaign_id) ?? row.promo_code}</span>
                  <span className="font-mono text-[13px] font-normal text-muted">{row.promo_code}</span>
                </th>
                <td className="px-3 py-3.5 text-right">
                  {row.redemption_limit === null ? row.successful_redemptions : fmt(t.campaigns.ofLimit, { count: row.successful_redemptions, limit: row.redemption_limit })}
                </td>
                <td className="px-3 py-3.5 text-right">{row.reserved_redemptions}</td>
                <td className="px-3 py-3.5 text-right">{money(row.discount_total)}</td>
                <td className="px-3 py-3.5 text-right">{row.attributed_order_count}</td>
                <td className="px-3 py-3.5 text-right">{money(row.gross_attributed_revenue)}</td>
                <td className="px-3 py-3.5 text-right">{money(row.reversed_revenue)}</td>
                <td className="px-3 py-3.5 text-right font-bold">{money(row.attributed_revenue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
