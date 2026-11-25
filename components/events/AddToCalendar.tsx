"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { catalogApi } from "@/lib/api/endpoints";
import type { Event } from "@/lib/api/types";
import { googleCalendarUrl, icsFilename, outlookCalendarUrl } from "@/lib/calendar";
import { saveBlob } from "@/lib/download";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";

const LINK = "inline-flex h-11 items-center rounded-xl border border-field bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-canvas";

/** SRS 4.11: one-click calendar links and the .ics file. */
export function AddToCalendar({ event }: { event: Event }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const cancelled = event.status === "CANCELLED";
  // Runs in the browser only: the event is never rendered on the server.
  const url = `${window.location.origin}/catalog/${event.id}`;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      saveBlob(await catalogApi.calendar(event.id), icsFilename(event));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="calendar-h" className="flex flex-col gap-3">
      <h2 id="calendar-h" className="text-lg font-bold">{t.calendar.title}</h2>
      {cancelled && <p className="text-sm text-muted">{t.calendar.cancelled}</p>}
      <div className="flex flex-wrap gap-2">
        {!cancelled && (
          <>
            <a href={googleCalendarUrl(event, url)} target="_blank" rel="noopener noreferrer" className={LINK}>{t.calendar.google}</a>
            <a href={outlookCalendarUrl(event, url)} target="_blank" rel="noopener noreferrer" className={LINK}>{t.calendar.outlook}</a>
          </>
        )}
        <Button variant="secondary" loading={busy} onClick={download}>{t.calendar.ics}</Button>
      </div>
      {error !== null && <Alert tone="error">{errorMessage(error, t)}</Alert>}
    </section>
  );
}
