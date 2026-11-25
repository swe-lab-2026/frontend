"use client";

import { SiteFrame } from "@/components/chrome";
import { LinkButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <SiteFrame>
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
        <h1 className="text-[28px] font-bold tracking-tight">{t.common.notFound}</h1>
        <p className="text-[15px] text-muted">{t.common.notFoundText}</p>
        <LinkButton href="/catalog">{t.common.toCatalog}</LinkButton>
      </div>
    </SiteFrame>
  );
}
