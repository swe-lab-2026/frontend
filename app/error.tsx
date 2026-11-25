"use client";

import { SiteFrame } from "@/components/chrome";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function PageError({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return (
    <SiteFrame>
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
        <h1 className="text-[28px] font-bold tracking-tight">{t.common.pageError}</h1>
        <Button onClick={retry}>{t.common.retry}</Button>
      </div>
    </SiteFrame>
  );
}
