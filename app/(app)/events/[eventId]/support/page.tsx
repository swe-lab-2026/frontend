"use client";

import { CaseList } from "@/components/support/CaseList";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEventContext } from "../EventContext";

export default function EventSupportPage() {
  const { t } = useI18n();
  const { event } = useEventContext();
  return (
    <Card aria-labelledby="event-support-h">
      <title>{`${t.support.tab} · ${event.title} — BiletFlow`}</title>
      <CardHeader
        id="event-support-h"
        title={t.support.eventTitle}
        description={t.support.eventHint}
        action={<LinkButton variant="secondary" href={`/support/new?event=${event.id}`}>{t.support.contactPlatform}</LinkButton>}
      />
      <CaseList query={{ role: "handler", event_id: event.id }} empty={t.support.emptyHandle} />
    </Card>
  );
}
