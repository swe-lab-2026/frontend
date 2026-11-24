"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, LinkButton, PageLoader } from "@/components/ui";
import { campaignsApi } from "@/lib/api/endpoints";
import type { CampaignResolution } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";

/** Target of a Campaign QR code: opens the event with the promotion applied. */
export default function CampaignLinkPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { data, error, reload } = useApi<CampaignResolution>(() => campaignsApi.resolve(token), [token]);

  useEffect(() => {
    // replace(): "Back" must not land here and bounce forward again.
    if (data) router.replace(`/catalog/${data.event.id}?campaign=${encodeURIComponent(data.promotion.campaign_token)}`);
  }, [data, router]);

  if (!error) return <PageLoader label={t.common.loading} />;
  return (
    <section className="mx-auto flex w-full max-w-[560px] flex-col gap-5 rounded-[20px] bg-surface p-6 sm:p-8">
      <title>{`${t.promo.linkTitle} — BiletFlow`}</title>
      <h1 className="text-[28px] font-bold tracking-tight">{t.promo.linkTitle}</h1>
      <Alert tone="error">{errorMessage(error, t)}</Alert>
      <p className="text-[15px] text-muted">{t.promo.linkHint}</p>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/catalog">{t.order.browseMore}</LinkButton>
        <button type="button" onClick={reload} className="px-2 text-[15px] font-semibold text-brand-ink hover:underline">
          {t.common.retry}
        </button>
      </div>
    </section>
  );
}
