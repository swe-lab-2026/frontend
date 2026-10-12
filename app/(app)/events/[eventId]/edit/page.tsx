"use client";

import { useRouter } from "next/navigation";
import { EventForm } from "@/components/events/EventForm";
import { eventsApi } from "@/lib/api/endpoints";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEventContext } from "../EventContext";

export default function EditEventPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { event, setEvent } = useEventContext();

  return (
    <EventForm
      event={event}
      submitLabel={t.common.save}
      cancelHref={`/events/${event.id}`}
      onSubmit={async (payload) => {
        setEvent(await eventsApi.update(event.id, payload));
        router.push(`/events/${event.id}`);
      }}
    />
  );
}
