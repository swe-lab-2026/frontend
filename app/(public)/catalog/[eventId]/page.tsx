"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, BackLink, Badge, Button, LinkButton, PageLoader } from "@/components/ui";
import { catalogApi, ordersApi } from "@/lib/api/endpoints";
import type { Event, TicketType } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { buildOrder, formatMoney, registrationWindow, stepQuantity, ticketAvailability } from "@/lib/registration";
import { useApi } from "@/lib/useApi";

export default function PublicEventPage() {
  const { t, intlLocale } = useI18n();
  const { status, user } = useAuth();
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();

  const { data, error: loadError, reload } = useApi<[Event, TicketType[]]>(
    () => Promise.all([catalogApi.event(eventId), catalogApi.ticketTypes(eventId)]),
    [eventId],
  );
  // Fixed per page view so availability does not flicker between renders.
  const [now] = useState(() => new Date());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (loadError && !data) {
    return (
      <>
        <BackLink href="/catalog">{t.attend.backToCatalog}</BackLink>
        <Alert tone="error">
          {errorMessage(loadError, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">
            {t.common.retry}
          </button>
        </Alert>
      </>
    );
  }
  if (!data) return <PageLoader label={t.common.loading} />;

  const [event, allTicketTypes] = data;
  // Owners previewing their own event also receive hidden types.
  const ticketTypes = allTicketTypes.filter((tt) => !tt.is_hidden);
  const regWindow = registrationWindow(event, now);
  const canRegister = regWindow === "open";
  const date = (iso: string) => formatDateTime(iso, event.timezone, intlLocale);
  const place = [event.venue_name, event.venue_address, event.city].filter(Boolean).join(", ");
  const cover = event.images[0];

  const selected = ticketTypes.filter((tt) => (quantities[tt.id] ?? 0) > 0);
  const totalTickets = selected.reduce((sum, tt) => sum + quantities[tt.id], 0);
  const totalAmount = selected.reduce((sum, tt) => sum + Number(tt.price) * quantities[tt.id], 0);
  const currency = ticketTypes[0]?.currency ?? "KZT";

  const windowNotice =
    event.status === "CANCELLED" ? t.attend.cancelled
    : regWindow === "notOpen" && event.registration_starts_at ? fmt(t.attend.regNotOpen, { date: date(event.registration_starts_at) })
    : regWindow === "closed" ? t.attend.regClosed
    : regWindow === "unavailable" ? t.attend.unavailable
    : null;

  function step(tt: TicketType, delta: 1 | -1) {
    setSubmitError(null);
    setQuantities((prev) => ({ ...prev, [tt.id]: stepQuantity(prev[tt.id] ?? 0, delta, tt.min_per_order, tt.max_per_order) }));
  }

  async function handleRegister() {
    if (totalTickets === 0) {
      setSubmitError(t.attend.selectHint);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await ordersApi.create(buildOrder(event.id, quantities));
      router.push(`/orders/${order.id}`);
    } catch (error) {
      setSubmitError(errorMessage(error, t));
      setSubmitting(false);
    }
  }

  return (
    <>
      <title>{`${event.title} — BiletFlow`}</title>
      <BackLink href="/catalog">{t.attend.backToCatalog}</BackLink>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="flex min-w-0 flex-col gap-6 rounded-[20px] bg-surface p-6 sm:p-8">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- organizer-supplied URLs from arbitrary hosts
            <img src={cover.object_key} alt={cover.alt_text ?? ""} className="aspect-[2/1] w-full rounded-[14px] bg-[#e9ecef] object-cover" />
          )}
          <div className="flex flex-col gap-3">
            {event.category && (
              <span className="text-[13px] font-semibold uppercase tracking-wide text-brand-ink">
                {(t.categories as Record<string, string>)[event.category] ?? event.category}
              </span>
            )}
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">{event.title}</h1>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] text-muted">{t.event.when}</dt>
              <dd className="text-[15px] font-semibold">
                {date(event.starts_at)} — {date(event.ends_at)}
              </dd>
            </div>
            {place && (
              <div className="flex flex-col gap-1">
                <dt className="text-[13px] text-muted">{t.event.where}</dt>
                <dd className="text-[15px] font-semibold">{place}</dd>
              </div>
            )}
          </dl>

          {event.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">{t.attend.about}</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{event.description}</p>
            </section>
          )}
          {event.refund_policy && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">{t.attend.refundPolicy}</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{event.refund_policy}</p>
            </section>
          )}
        </article>

        <aside aria-labelledby="tickets-h" className="flex flex-col gap-5 rounded-[20px] bg-surface p-6 lg:sticky lg:top-6">
          <div className="flex flex-col gap-1">
            <h2 id="tickets-h" className="text-xl font-bold">{t.attend.tickets}</h2>
            {canRegister && event.registration_ends_at && (
              <p className="text-sm text-muted">{fmt(t.attend.registrationCloses, { date: date(event.registration_ends_at) })}</p>
            )}
          </div>

          {windowNotice && <Alert tone={event.status === "CANCELLED" ? "error" : "info"}>{windowNotice}</Alert>}

          {ticketTypes.length === 0 ? (
            <p className="text-[15px] text-muted">{t.attend.noTickets}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {ticketTypes.map((tt) => {
                const availability = ticketAvailability(tt, now);
                const orderable = canRegister && availability === "available";
                const quantity = quantities[tt.id] ?? 0;
                return (
                  <li key={tt.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-base font-semibold">{tt.name}</span>
                        {tt.description && <span className="text-sm text-muted">{tt.description}</span>}
                      </div>
                      <span className="shrink-0 text-base font-bold">
                        {tt.is_free ? t.tickets.free : formatMoney(tt.price, tt.currency, intlLocale)}
                      </span>
                    </div>

                    {availability === "available" ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-muted">
                          {fmt(t.attend.perOrder, { min: tt.min_per_order, max: tt.max_per_order })}
                        </span>
                        {orderable && (
                          <div className="flex items-center gap-1">
                            <StepButton label={fmt(t.attend.decrease, { name: tt.name })} disabled={quantity === 0} onClick={() => step(tt, -1)}>
                              −
                            </StepButton>
                            <output aria-label={fmt(t.attend.quantity, { name: tt.name })} className="w-9 text-center text-base font-semibold tabular-nums">
                              {quantity}
                            </output>
                            <StepButton label={fmt(t.attend.increase, { name: tt.name })} disabled={quantity >= tt.max_per_order} onClick={() => step(tt, 1)}>
                              +
                            </StepButton>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge tone={availability === "paid" ? "info" : "neutral"}>
                        {availability === "paid"
                          ? t.attend.paidUnavailable
                          : availability === "notStarted" && tt.sales_starts_at
                            ? fmt(t.attend.salesNotStarted, { date: date(tt.sales_starts_at) })
                            : t.attend.salesEnded}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canRegister && ticketTypes.some((tt) => ticketAvailability(tt, now) === "available") && (
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-muted">{t.attend.total}</span>
                <span className="text-xl font-bold">
                  {totalAmount === 0 && totalTickets > 0 ? t.tickets.free : formatMoney(totalAmount, currency, intlLocale)}
                </span>
              </div>

              {submitError && <Alert tone="error">{submitError}</Alert>}

              {status === "authenticated" ? (
                <>
                  <Button size="lg" loading={submitting} disabled={totalTickets === 0} onClick={handleRegister}>
                    {submitting ? t.attend.registering : t.attend.register}
                  </Button>
                  {user && (
                    <p className="text-[13px] text-muted">
                      {fmt(t.attend.registerAs, { name: `${user.first_name} ${user.last_name}`.trim(), email: user.email })}
                    </p>
                  )}
                </>
              ) : status === "anonymous" ? (
                <>
                  <LinkButton size="lg" href={`/login?next=${encodeURIComponent(`/catalog/${event.id}`)}`}>
                    {t.attend.signInToRegister}
                  </LinkButton>
                  <p className="text-[13px] text-muted">
                    {t.attend.signInNote}{" "}
                    <Link href={`/register?next=${encodeURIComponent(`/catalog/${event.id}`)}`} className="font-semibold text-brand-ink hover:underline">
                      {t.auth.register}
                    </Link>
                  </p>
                </>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-field bg-surface text-xl font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-subtle"
    >
      {children}
    </button>
  );
}
