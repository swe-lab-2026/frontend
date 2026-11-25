"use client";

import { useState } from "react";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { CampaignPerformance } from "@/components/campaigns/CampaignPerformance";
import { CampaignQr } from "@/components/campaigns/CampaignQr";
import { Alert, Badge, Button, Card, CardHeader, PageLoader, PlusIcon } from "@/components/ui";
import { campaignsApi, ticketTypesApi } from "@/lib/api/endpoints";
import type { Campaign, CampaignAnalytics, TicketType } from "@/lib/api/types";
import { campaignTone, discountLabel } from "@/lib/campaigns";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";

export default function CampaignsPage() {
  const { t, intlLocale } = useI18n();
  const { event } = useEventContext();
  const { data, error: loadError, reload } = useApi<[Campaign[], CampaignAnalytics[], TicketType[]]>(
    () => Promise.all([campaignsApi.list(event.id), campaignsApi.analytics(event.id), ticketTypesApi.list(event.id)]),
    [event.id],
  );
  const [creating, setCreating] = useState(false);
  const [openQr, setOpenQr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (loadError && !data) {
    return (
      <Alert tone="error">
        {errorMessage(loadError, t)}{" "}
        <button type="button" onClick={reload} className="font-semibold underline">
          {t.common.retry}
        </button>
      </Alert>
    );
  }
  if (!data) return <PageLoader label={t.common.loading} />;

  const [campaigns, analytics, ticketTypes] = data;
  // The backend refuses campaign changes once the event is closed.
  const editable = event.status !== "CANCELLED" && event.status !== "COMPLETED";
  const date = (iso: string) => formatDateTime(iso, event.timezone, intlLocale);
  const typeName = (id: string) => ticketTypes.find((tt) => tt.id === id)?.name ?? "—";

  const windowText = (c: Campaign) =>
    c.starts_at && c.expires_at ? `${date(c.starts_at)} — ${date(c.expires_at)}`
    : c.starts_at ? fmt(t.campaigns.from, { date: date(c.starts_at) })
    : c.expires_at ? fmt(t.campaigns.until, { date: date(c.expires_at) })
    : t.campaigns.noWindow;

  async function toggle(campaign: Campaign) {
    if (campaign.is_active && !window.confirm(fmt(t.campaigns.confirmDisable, { name: campaign.name }))) return;
    setBusyId(campaign.id);
    setNotice(null);
    try {
      await campaignsApi.setActive(event.id, campaign.id, !campaign.is_active);
      setNotice({ tone: "success", text: campaign.is_active ? t.campaigns.disabled : t.campaigns.enabled });
      reload();
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err, t) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <title>{`${t.campaigns.tab} · ${event.title} — BiletFlow`}</title>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {Boolean(loadError) && <Alert tone="error">{errorMessage(loadError, t)}</Alert>}

      {creating && (
        <CampaignForm
          ticketTypes={ticketTypes}
          timeZone={event.timezone}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            const created = await campaignsApi.create(event.id, payload);
            setCreating(false);
            setOpenQr(created.id);
            setNotice({ tone: "success", text: t.campaigns.created });
            reload();
          }}
        />
      )}

      <Card aria-labelledby="campaigns-h">
        <CardHeader
          id="campaigns-h"
          title={t.campaigns.title}
          description={t.campaigns.hint}
          action={
            editable && (
              <Button onClick={() => { setNotice(null); setCreating(true); }} aria-expanded={creating}>
                <PlusIcon size={16} />
                {t.campaigns.add}
              </Button>
            )
          }
        />
        {campaigns.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-muted">{t.campaigns.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[17px] font-semibold">{c.name}</span>
                      <Badge tone={campaignTone(c.effective_status)}>
                        {(t.campaigns.status as Record<string, string>)[c.effective_status] ?? c.effective_status}
                      </Badge>
                    </div>
                    <span className="text-sm text-ink-2">
                      <span className="font-mono font-semibold">{c.code}</span> ·{" "}
                      {fmt(t.promo.discountOf, { discount: discountLabel(c.discount_type, c.discount_value, intlLocale) })}
                    </span>
                    <span className="text-[13px] text-muted">
                      {windowText(c)} ·{" "}
                      {c.redemption_limit === null
                        ? fmt(t.campaigns.usedUnlimited, { count: c.redemption_count })
                        : fmt(t.campaigns.used, { count: c.redemption_count, limit: c.redemption_limit })}{" "}
                      · {c.ticket_type_ids.length === 0 ? t.campaigns.allTypes : c.ticket_type_ids.map(typeName).join(", ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" aria-expanded={openQr === c.id} onClick={() => setOpenQr(openQr === c.id ? null : c.id)}>
                      {openQr === c.id ? t.campaigns.hideQr : t.campaigns.showQr}
                    </Button>
                    {editable && (
                      <Button variant={c.is_active ? "danger-outline" : "secondary"} loading={busyId === c.id} onClick={() => toggle(c)}>
                        {c.is_active ? t.campaigns.disable : t.campaigns.enable}
                      </Button>
                    )}
                  </div>
                </div>
                {openQr === c.id && <CampaignQr campaign={c} eventTitle={event.title} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {analytics.length > 0 && (
        <Card aria-labelledby="perf-h">
          <CardHeader
            id="perf-h"
            title={t.campaigns.performance}
            description={t.campaigns.performanceHint}
            action={<Button variant="secondary" onClick={reload}>{t.inventory.refresh}</Button>}
          />
          <CampaignPerformance campaigns={campaigns} analytics={analytics} />
        </Card>
      )}
    </>
  );
}
