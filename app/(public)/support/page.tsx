"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { CaseList } from "@/components/support/CaseList";
import { RequireAuth } from "@/components/support/RequireAuth";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";

function Support() {
  const { t } = useI18n();
  const [role, setRole] = useState<"requester" | "handler">("requester");

  return (
    <Card aria-labelledby="support-h" className="mx-auto w-full max-w-[880px]">
      <title>{`${t.support.title} — BiletFlow`}</title>
      <CardHeader id="support-h" title={t.support.title} description={t.support.hint} action={<LinkButton href="/support/new">{t.support.newCase}</LinkButton>} />
      <div role="group" aria-label={t.support.title} className="flex flex-wrap gap-2">
        {(["requester", "handler"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            onClick={() => setRole(value)}
            className={`h-10 rounded-full border px-4 text-sm font-semibold ${role === value ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-chip"}`}
          >
            {value === "requester" ? t.support.mine : t.support.toHandle}
          </button>
        ))}
      </div>
      <Link href="/support/reports" className="w-fit text-sm font-semibold text-brand-ink hover:underline">{t.reports.mine}</Link>
      <CaseList key={role} query={{ role }} empty={role === "requester" ? t.support.emptyMine : t.support.emptyHandle} />
    </Card>
  );
}

export default function SupportPage() {
  return (
    <Suspense>
      <RequireAuth>
        <Support />
      </RequireAuth>
    </Suspense>
  );
}
