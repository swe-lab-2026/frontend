"use client";

import { useState } from "react";
import { Alert, Button, Card, CardHeader, Input, PageLoader } from "@/components/ui";
import { eventsApi, ordersApi } from "@/lib/api/endpoints";
import type { EventAttendee } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";

export default function AttendeesPage() {
  const { t, intlLocale } = useI18n();
  const { event, version } = useEventContext();
  // The backend caps one page at 500, which covers MVP-sized events.
  const { data: attendees, error, reload } = useApi<EventAttendee[]>(() => eventsApi.attendees(event.id), [event.id, version]);
  const [query, setQuery] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const eventStarted = new Date(event.starts_at) <= new Date();

  // Free registrations only: cancelling does not refund, so paid orders need
  // a refund flow instead (SRS 4.9).
  async function cancelRegistration(a: EventAttendee) {
    if (!window.confirm(fmt(t.attendees.confirmCancel, { name: a.full_name || a.email }))) return;
    setCancellingId(a.order_id);
    setNotice(null);
    try {
      await ordersApi.cancel(a.order_id);
      setNotice({ tone: "success", text: fmt(t.attendees.cancelled, { number: a.order_number }) });
      reload();
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err, t) });
    } finally {
      setCancellingId(null);
    }
  }

  const needle = query.trim().toLowerCase();
  const visible = (attendees ?? []).filter(
    (a) => !needle || a.full_name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle),
  );
  const ticketCount = (attendees ?? []).reduce((sum, a) => sum + a.ticket_count, 0);

  return (
    <Card aria-labelledby="attendees-h">
      <title>{`${t.attendees.tab} · ${event.title} — BiletFlow`}</title>
      <CardHeader
        id="attendees-h"
        title={t.attendees.title}
        description={t.attendees.hint}
        action={
          <Button variant="secondary" onClick={reload}>
            {t.attendees.refresh}
          </Button>
        }
      />

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {error ? (
        <Alert tone="error">{errorMessage(error, t)}</Alert>
      ) : !attendees ? (
        <PageLoader label={t.common.loading} />
      ) : attendees.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">{t.attendees.empty}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="w-full max-w-[360px]">
              <span className="sr-only">{t.attendees.search}</span>
              <Input
                type="search"
                placeholder={t.attendees.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-field bg-surface px-3.5 text-base placeholder:text-muted"
              />
            </label>
            <span className="text-sm text-muted">{fmt(t.attendees.summary, { people: attendees.length, tickets: ticketCount })}</span>
          </div>

          {visible.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-muted">{t.attendees.noMatches}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line-soft">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f7f8f9] text-left text-muted">
                    <th scope="col" className="px-4 py-3 font-semibold">{t.attendees.name}</th>
                    <th scope="col" className="px-3 py-3 font-semibold">{t.attendees.email}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{t.attendees.tickets}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{t.attendees.total}</th>
                    <th scope="col" className="px-3 py-3 font-semibold">{t.attendees.order}</th>
                    <th scope="col" className="px-3 py-3 font-semibold">{t.attendees.registered}</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      <span className="sr-only">{t.common.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a) => (
                    <tr key={a.attendee_id} className="border-t border-line-soft">
                      <td className="px-4 py-3.5 text-[15px] font-semibold">{a.full_name || "—"}</td>
                      <td className="px-3 py-3.5">
                        <a href={`mailto:${a.email}`} className="text-brand-ink hover:underline">
                          {a.email}
                        </a>
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold">{a.ticket_count}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right">
                        {Number(a.total_amount) === 0 ? t.tickets.free : formatMoney(a.total_amount, a.currency, intlLocale)}
                      </td>
                      <td className="px-3 py-3.5 tabular-nums">#{a.order_number}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-muted">{formatDateTime(a.registered_at, event.timezone, intlLocale)}</td>
                      <td className="px-4 py-2 text-right">
                        {Number(a.total_amount) === 0 && !eventStarted && (
                          <Button
                            variant="ghost"
                            className="text-danger-ink"
                            loading={cancellingId === a.order_id}
                            disabled={cancellingId !== null}
                            onClick={() => cancelRegistration(a)}
                            aria-label={fmt(t.attendees.cancelFor, { name: a.full_name || a.email })}
                          >
                            {t.attendees.cancel}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
