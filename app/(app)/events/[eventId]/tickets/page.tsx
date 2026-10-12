"use client";

import { useState } from "react";
import { TicketTypeForm } from "@/components/events/TicketTypeForm";
import { Alert, Badge, Button, PageLoader, PlusIcon } from "@/components/ui";
import { eventsApi, ticketTypesApi } from "@/lib/api/endpoints";
import type { EventInventory, TicketType, TicketTypeInventory } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";

type Editing = { mode: "new" } | { mode: "edit"; ticketType: TicketType } | null;

export default function TicketsPage() {
  const { t, intlLocale } = useI18n();
  const { event, version, invalidate } = useEventContext();
  const { data, error: loadError } = useApi<[TicketType[], EventInventory]>(
    () => Promise.all([ticketTypesApi.list(event.id), eventsApi.inventory(event.id)]),
    [event.id, version],
  );
  const [ticketTypes, inventory] = data ?? [null, null];
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const stockFor = (id: string): TicketTypeInventory | undefined => inventory?.ticket_types.find((row) => row.ticket_type_id === id);

  const price = (tt: TicketType) =>
    tt.is_free
      ? t.tickets.free
      : new Intl.NumberFormat(intlLocale, { style: "currency", currency: tt.currency, maximumFractionDigits: 2 }).format(Number(tt.price));

  const salesWindow = (tt: TicketType) => {
    if (!tt.sales_starts_at && !tt.sales_ends_at) return t.tickets.always;
    const from = tt.sales_starts_at ? formatDateTime(tt.sales_starts_at, event.timezone, intlLocale) : "…";
    const to = tt.sales_ends_at ? formatDateTime(tt.sales_ends_at, event.timezone, intlLocale) : "…";
    return `${from} — ${to}`;
  };

  async function toggleHidden(tt: TicketType) {
    setBusyId(tt.id);
    setError(null);
    try {
      // DELETE hides on the backend; un-hiding is a PATCH.
      if (tt.is_hidden) await ticketTypesApi.update(event.id, tt.id, { is_hidden: false });
      else await ticketTypesApi.hide(event.id, tt.id);
      invalidate();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusyId(null);
    }
  }

  if (ticketTypes === null && !loadError) return <PageLoader label={t.common.loading} />;

  const summary = inventory && [
    { label: t.inventory.eventCapacity, value: inventory.event_capacity ?? "—" },
    { label: t.inventory.totalSold, value: inventory.total_sold },
    { label: t.inventory.totalReserved, value: inventory.total_reserved },
    { label: t.inventory.totalAvailable, value: inventory.total_available, accent: true },
  ];

  return (
    <>
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 rounded-2xl bg-surface px-5 py-4">
              <span className="text-sm text-muted">{item.label}</span>
              <span className={`text-[26px] font-bold ${item.accent ? "text-brand-ink" : ""}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {Boolean(error || loadError) && <Alert tone="error">{error ?? errorMessage(loadError, t)}</Alert>}

      <section aria-labelledby="tt-h" className="flex flex-col gap-4 rounded-2xl bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="tt-h" className="text-xl font-bold">{t.event.tabs.tickets}</h2>
            <p className="text-[13px] text-muted">{t.tickets.hiddenNote}</p>
          </div>
          <Button onClick={() => setEditing({ mode: "new" })} aria-expanded={editing?.mode === "new"}>
            <PlusIcon size={16} />
            {t.tickets.add}
          </Button>
        </div>

        {ticketTypes && ticketTypes.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-muted">{t.event.noTicketTypes}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line-soft">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#f7f8f9] text-left text-muted">
                  <th scope="col" className="min-w-[240px] px-4 py-3 font-semibold">{t.inventory.ticketType}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t.tickets.price}</th>
                  {[t.inventory.capacity, t.inventory.reserved, t.inventory.sold, t.inventory.returned, t.inventory.checkedIn, t.inventory.available].map((h) => (
                    <th key={h} scope="col" className="px-3 py-3 text-right font-semibold">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t.common.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ticketTypes?.map((tt) => {
                  const stock = stockFor(tt.id);
                  return (
                    <tr key={tt.id} className={`border-t border-line-soft ${tt.is_hidden ? "bg-[#fafafb] text-muted" : ""}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2 text-[15px] font-semibold">
                            {tt.name}
                            {tt.is_hidden && <Badge>{t.tickets.hiddenBadge}</Badge>}
                          </span>
                          <span className="text-[13px] text-muted">
                            {fmt(t.tickets.perOrder, { min: tt.min_per_order, max: tt.max_per_order })} · {t.tickets.salesWindow}: {salesWindow(tt)}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-semibold">{price(tt)}</td>
                      <td className="px-3 py-3.5 text-right">{tt.capacity}</td>
                      <td className="px-3 py-3.5 text-right">{stock?.reserved ?? "—"}</td>
                      <td className="px-3 py-3.5 text-right">{stock?.sold ?? "—"}</td>
                      <td className="px-3 py-3.5 text-right">{stock?.returned ?? "—"}</td>
                      <td className="px-3 py-3.5 text-right">{stock?.checked_in ?? "—"}</td>
                      <td className="px-3 py-3.5 text-right font-bold">{stock?.available ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <Button variant="secondary" className="h-10 px-3 text-sm" onClick={() => setEditing({ mode: "edit", ticketType: tt })}>
                          {t.common.edit}
                        </Button>
                        <Button variant="ghost" className="h-10 px-3 text-sm" loading={busyId === tt.id} onClick={() => toggleHidden(tt)}>
                          {tt.is_hidden ? t.tickets.unhide : t.tickets.hide}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <TicketTypeForm
          key={editing.mode === "edit" ? editing.ticketType.id : "new"}
          ticketType={editing.mode === "edit" ? editing.ticketType : undefined}
          timeZone={event.timezone}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            if (editing.mode === "edit") await ticketTypesApi.update(event.id, editing.ticketType.id, payload);
            else await ticketTypesApi.create(event.id, payload);
            setEditing(null);
            invalidate();
          }}
        />
      )}
    </>
  );
}
