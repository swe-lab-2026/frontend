"use client";

import { useRouter } from "next/navigation";
import { EventForm } from "@/components/events/EventForm";
import { BackLink } from "@/components/ui";
import { eventsApi } from "@/lib/api/endpoints";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function NewEventPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink href="/events">{t.nav.dashboard}</BackLink>
        <h1 className="text-[32px] font-bold tracking-tight">{t.event.newTitle}</h1>
      </div>
      <EventForm
        submitLabel={t.event.createButton}
        cancelHref="/events"
        onSubmit={async (payload) => {
          const event = await eventsApi.create(payload);
          router.push(`/events/${event.id}?created=1`);
        }}
      />
    </>
  );
}
