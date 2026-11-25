"use client";

import { useState } from "react";
import { CampaignPerformance } from "@/components/campaigns/CampaignPerformance";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageLoader, Select } from "@/components/ui";
import { adminApi, campaignsApi } from "@/lib/api/endpoints";
import type { AdminEvent, Campaign, CampaignAnalytics, Page } from "@/lib/api/types";
import { campaignTone, discountLabel } from "@/lib/campaigns";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";

/** Money results are per event, so an event is picked first. Read-only. */
export function AdminCampaigns() {
  const { t, intlLocale } = useI18n();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState("");
  const { data: events, error } = useApi<Page<AdminEvent>>(() => adminApi.events({ q: q || undefined, limit: 100, offset: 0 }), [q]);
  const eventId = events?.items.some((e) => e.id === picked) ? picked : (events?.items[0]?.id ?? "");
  const { data, error: campaignError } = useApi<{ eventId: string; rows: [Campaign[], CampaignAnalytics[]] } | null>(
    () => (eventId ? Promise.all([campaignsApi.list(eventId), campaignsApi.analytics(eventId)]).then((rows) => ({ eventId, rows })) : Promise.resolve(null)),
    [eventId],
  );
  const rows = data?.eventId === eventId ? data.rows : null;

  return (
    <Card aria-labelledby="admin-camp-h">
      <CardHeader id="admin-camp-h" title={t.admin.performanceByEvent} description={t.campaigns.performanceHint} />
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex min-w-0 flex-[1_1_280px] items-end gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input.trim()); }}>
          <Field label={t.support.search} className="flex-1">
            {(props) => <Input {...props} type="search" placeholder={t.admin.searchEvents} value={input} onChange={(e) => setInput(e.target.value)} maxLength={200} />}
          </Field>
          <Button type="submit" variant="secondary" className="h-12">{t.support.find}</Button>
        </form>
        <Field label={t.admin.columns.event} className="flex-[1_1_240px]">
          {(props) => (
            <Select {...props} value={eventId} onChange={(e) => setPicked(e.target.value)} disabled={!events?.items.length}>
              {events?.items.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </Select>
          )}
        </Field>
      </div>
      {error || campaignError ? (
        <Alert tone="error">{errorMessage(error ?? campaignError, t)}</Alert>
      ) : !events || (eventId && !rows) ? (
        <PageLoader label={t.common.loading} />
      ) : !rows || rows[0].length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">{t.campaigns.empty}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2 text-sm">
            {rows[0].map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2.5">
                <span className="font-semibold">{item.name}</span>
                <span className="font-mono">{item.code}</span>
                <span className="text-muted">{fmt(t.promo.discountOf, { discount: discountLabel(item.discount_type, item.discount_value, intlLocale) })}</span>
                <Badge tone={campaignTone(item.effective_status)}>{(t.campaigns.status as Record<string, string>)[item.effective_status] ?? item.effective_status}</Badge>
              </li>
            ))}
          </ul>
          <CampaignPerformance campaigns={rows[0]} analytics={rows[1]} />
        </>
      )}
    </Card>
  );
}
