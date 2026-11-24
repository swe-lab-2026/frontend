"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PriceSummary } from "@/components/checkout/PriceSummary";
import { Alert, BackLink, Badge, Button, Field, Input, LinkButton, PageLoader } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { campaignsApi, catalogApi, ordersApi } from "@/lib/api/endpoints";
import type { CampaignResolution, Event, TicketType } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { discountLabel, PROMO_CODE_RE } from "@/lib/campaigns";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import {
  buildOrder,
  decodeSelection,
  eventHref,
  formatMoney,
  isQuantityValid,
  maxQuantity,
  type Promo,
  registrationWindow,
  stepQuantity,
  ticketAvailability,
} from "@/lib/registration";
import { useApi } from "@/lib/useApi";
import { usePromoQuote } from "@/lib/usePromoQuote";

/** What the server revealed when it rejected an attempt (see ticketAvailability). */
type Known = { left: Record<string, number>; paidInactive: boolean };

type SubmitError = { text: string; orderId?: string };

export default function PublicEventPage() {
  return (
    <Suspense>
      <EventPage />
    </Suspense>
  );
}

/** A scanned campaign that cannot be used must not hide the event itself. */
type CampaignState = { resolution: CampaignResolution } | { error: unknown } | null;

async function resolveCampaign(token: string | null, eventId: string): Promise<CampaignState> {
  if (!token) return null;
  try {
    const resolution = await campaignsApi.resolve(token);
    if (resolution.event.id !== eventId) return { error: new ApiError(409, "PROMO_NOT_APPLICABLE", "") };
    return { resolution };
  } catch (error) {
    return { error };
  }
}

function EventPage() {
  const { t, intlLocale } = useI18n();
  const { status, user } = useAuth();
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();
  const params = useSearchParams();
  const campaignToken = params.get("campaign");

  const { data, error: loadError, reload } = useApi<[Event, TicketType[], CampaignState]>(
    () => Promise.all([catalogApi.event(eventId), catalogApi.ticketTypes(eventId), resolveCampaign(campaignToken, eventId)]),
    [eventId, campaignToken],
  );
  // Fixed per page view so availability does not flicker between renders.
  const [now] = useState(() => new Date());
  const [picked, setPicked] = useState<Record<string, number>>(() => decodeSelection(params.get("items")));
  const [known, setKnown] = useState<Known>({ left: {}, paidInactive: false });
  // "link": whatever campaign the URL carries; otherwise a typed code or none.
  const [promoChoice, setPromoChoice] = useState<"link" | string | null>(() => {
    const code = params.get("promo");
    return code && PROMO_CODE_RE.test(code) ? `code:${code}` : "link";
  });
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

  const [event, allTicketTypes, campaign] = data ?? [];
  // Owners previewing their own event also receive hidden types.
  const ticketTypes = (allTicketTypes ?? []).filter((tt) => !tt.is_hidden);
  const regWindow = event ? registrationWindow(event, now) : "unavailable";
  const canRegister = regWindow === "open" && !event?.is_suspended;
  const availabilityOf = (tt: TicketType) => ticketAvailability(tt, now, { left: known.left[tt.id], paidInactive: known.paidInactive });

  // Everything that gets priced or submitted passes through here, so a stale
  // link or a ticket that just sold out can never end up in the order.
  const quantities: Record<string, number> = {};
  for (const tt of ticketTypes) {
    const quantity = picked[tt.id] ?? 0;
    if (canRegister && quantity > 0 && availabilityOf(tt) === "available" && isQuantityValid(tt, quantity, known.left[tt.id])) {
      quantities[tt.id] = quantity;
    }
  }

  const resolution = campaign && "resolution" in campaign ? campaign.resolution : null;
  const campaignError = campaign && "error" in campaign ? campaign.error : null;
  const promo: Promo | null = promoChoice?.startsWith("code:")
    ? { code: promoChoice.slice(5) }
    : promoChoice === "link" && resolution
      ? { campaign_token: resolution.promotion.campaign_token }
      : null;

  const selection = buildOrder(eventId, quantities).items;
  const { quote, error: quoteError, loading: quoting } = usePromoQuote(eventId, selection, promo, status === "authenticated");

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
  if (!data || !event) return <PageLoader label={t.common.loading} />;

  const date = (iso: string) => formatDateTime(iso, event.timezone, intlLocale);
  const place = [event.venue_name, event.venue_address, event.city].filter(Boolean).join(", ");
  const cover = event.images[0];
  const isOwner = user?.user_id === event.owner_user_id;

  const selected = ticketTypes.filter((tt) => (quantities[tt.id] ?? 0) > 0);
  const totalTickets = selected.reduce((sum, tt) => sum + quantities[tt.id], 0);
  const subtotal = selected.reduce((sum, tt) => sum + Number(tt.price) * quantities[tt.id], 0);
  const currency = selected[0]?.currency ?? "KZT";
  // A selection that costs nothing is confirmed at once, with no payment step.
  const isFree = quote ? Number(quote.final_total) === 0 : subtotal === 0;
  const hasAvailable = ticketTypes.some((tt) => availabilityOf(tt) === "available");
  const returnTo = eventHref(event.id, selection, promo);

  const windowNotice =
    event.status === "CANCELLED" ? t.attend.cancelled
    : regWindow === "notOpen" && event.registration_starts_at ? fmt(t.attend.regNotOpen, { date: date(event.registration_starts_at) })
    : regWindow === "closed" ? t.attend.regClosed
    : regWindow === "unavailable" ? t.attend.unavailable
    : null;

  function step(tt: TicketType, delta: 1 | -1) {
    setSubmitError(null);
    const max = maxQuantity(tt, known.left[tt.id]);
    setPicked((prev) => ({ ...prev, [tt.id]: stepQuantity(quantities[tt.id] ?? 0, delta, tt.min_per_order, max) }));
  }

  function applyCode(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!PROMO_CODE_RE.test(code)) {
      setCodeError(t.promo.codeFormat);
      return;
    }
    setCodeError(undefined);
    setSubmitError(null);
    setCodeInput("");
    setPromoChoice(`code:${code}`);
  }

  async function handleSubmit() {
    if (totalTickets === 0) {
      setSubmitError({ text: t.attend.selectHint });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await ordersApi.create(buildOrder(eventId, quantities, promo));
      router.push(`/orders/${order.id}`);
    } catch (error) {
      setSubmitError(describeRejection(error));
      setSubmitting(false);
    }
  }

  /** Remembers what the server revealed, so the same attempt is not offered again. */
  function describeRejection(error: unknown): SubmitError {
    const text = errorMessage(error, t);
    if (!(error instanceof ApiError)) return { text };
    const { available, ticket_type_id: typeId, order_id: orderId } = error.details;
    if (error.code === "TICKETS_SOLD_OUT" && typeof typeId === "string" && typeof available === "number") {
      setKnown((prev) => ({ ...prev, left: { ...prev.left, [typeId]: available } }));
    }
    if (error.code === "EVENT_SOLD_OUT" && typeof available === "number") {
      return { text: available > 0 ? fmt(t.attend.eventLeft, { count: available }) : text };
    }
    if (error.code === "PAID_SALES_NOT_ACTIVATED" || error.code === "PAID_SALES_SUSPENDED") setKnown((prev) => ({ ...prev, paidInactive: true }));
    if (error.code === "PROMO_ALREADY_RESERVED" && typeof orderId === "string") return { text, orderId };
    return { text };
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
          {event.is_suspended ? (
            <Alert tone="error">{t.errors.EVENT_SUSPENDED}</Alert>
          ) : isOwner && (event.status !== "PUBLISHED" || event.visibility !== "PUBLIC") && (
            <Alert tone="info">
              {event.status !== "PUBLISHED" ? t.attend.ownerNotPublished : event.visibility === "PRIVATE" ? t.attend.ownerPrivate : t.attend.ownerUnlisted}
            </Alert>
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
          {!isOwner && (
            <Link href={`/support/new?event=${event.id}`} className="w-fit text-sm font-semibold text-brand-ink hover:underline">
              {t.support.askOrganizer}
            </Link>
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

          {campaignError !== null && promoChoice === "link" && <Alert tone="error">{errorMessage(campaignError, t)}</Alert>}

          {ticketTypes.length === 0 ? (
            <p className="text-[15px] text-muted">{t.attend.noTickets}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {ticketTypes.map((tt) => {
                const availability = availabilityOf(tt);
                const left = known.left[tt.id];
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
                          {fmt(t.attend.perOrder, { min: tt.min_per_order, max: maxQuantity(tt) })}
                          {left !== undefined && <span className="block font-semibold text-warn-ink">{fmt(t.attend.left, { count: left })}</span>}
                        </span>
                        {canRegister && (
                          <div className="flex items-center gap-1">
                            <StepButton label={fmt(t.attend.decrease, { name: tt.name })} disabled={submitting || quantity === 0} onClick={() => step(tt, -1)}>
                              −
                            </StepButton>
                            <output aria-label={fmt(t.attend.quantity, { name: tt.name })} className="w-9 text-center text-base font-semibold tabular-nums">
                              {quantity}
                            </output>
                            <StepButton
                              label={fmt(t.attend.increase, { name: tt.name })}
                              disabled={submitting || quantity >= maxQuantity(tt, left)}
                              onClick={() => step(tt, 1)}
                            >
                              +
                            </StepButton>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge tone={availability === "soldOut" ? "danger" : "neutral"}>
                        {availability === "soldOut"
                          ? t.attend.soldOut
                          : availability === "paidInactive"
                            ? t.attend.paidInactive
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

          {canRegister && hasAvailable && (
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              {promo ? (
                <div className="flex items-start justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {"code" in promo ? fmt(t.promo.codeLabel, { code: promo.code.toUpperCase() }) : resolution?.promotion.name}
                    </span>
                    {"campaign_token" in promo && resolution ? (
                      <span>
                        {fmt(t.promo.discountOf, {
                          discount: discountLabel(resolution.promotion.discount_type, resolution.promotion.discount_value, intlLocale),
                        })}
                        {!resolution.promotion.applies_to_all_ticket_types && ` · ${t.promo.someTypes}`}
                      </span>
                    ) : quote ? (
                      <span>{fmt(t.promo.discountOf, { discount: discountLabel(quote.discount_type, quote.discount_value, intlLocale) })}</span>
                    ) : null}
                    {status === "anonymous" && <span>{t.promo.signIn}</span>}
                    {status === "authenticated" && totalTickets === 0 && <span>{t.promo.chooseTickets}</span>}
                  </div>
                  <button type="button" onClick={() => { setPromoChoice(null); setSubmitError(null); }} className="shrink-0 font-semibold underline">
                    {t.common.remove}
                  </button>
                </div>
              ) : (
                <form onSubmit={applyCode} noValidate className="flex items-end gap-2">
                  <Field label={t.promo.enter} optionalLabel={t.common.optional} error={codeError} className="flex-1">
                    {(props) => (
                      <Input {...props} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} maxLength={40} autoComplete="off" className={`${props.className} h-11 uppercase`} />
                    )}
                  </Field>
                  <Button type="submit" variant="secondary" disabled={!codeInput.trim()} className={codeError ? "mb-[26px]" : ""}>
                    {t.promo.apply}
                  </Button>
                </form>
              )}

              {quoteError !== null && <Alert tone="error">{errorMessage(quoteError, t)}</Alert>}

              {quote && Number(quote.subtotal) > 0 ? (
                <PriceSummary
                  currency={quote.currency}
                  subtotal={quote.subtotal}
                  discount={quote.discount_amount}
                  fee={quote.fee_amount}
                  total={quote.final_total}
                  promoCode={quote.code}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] text-muted">{subtotal > 0 ? t.checkout.subtotal : t.attend.total}</span>
                    <span className="text-xl font-bold">
                      {subtotal === 0 && totalTickets > 0 ? t.tickets.free : formatMoney(subtotal, currency, intlLocale)}
                    </span>
                  </div>
                  {subtotal > 0 && <p className="text-[13px] text-muted">{quoting ? t.promo.checking : t.checkout.feeNext}</p>}
                </div>
              )}

              {submitError && (
                <Alert tone="error">
                  {submitError.text}{" "}
                  {submitError.orderId && (
                    <Link href={`/orders/${submitError.orderId}`} className="font-semibold underline">
                      {t.promo.openOrder}
                    </Link>
                  )}
                </Alert>
              )}

              {status === "authenticated" ? (
                <>
                  <Button
                    size="lg"
                    loading={submitting}
                    disabled={totalTickets === 0 || quoting || quoteError !== null}
                    onClick={handleSubmit}
                  >
                    {submitting ? t.attend.registering : isFree ? t.attend.register : t.checkout.toPayment}
                  </Button>
                  {user && (
                    <div className="flex flex-col gap-0.5 text-[13px] text-muted">
                      <p>{fmt(t.attend.registerAs, { name: `${user.first_name} ${user.last_name}`.trim(), email: user.email })}</p>
                      <Link href="/profile" className="w-fit font-semibold text-brand-ink hover:underline">
                        {t.checkout.editDetails}
                      </Link>
                    </div>
                  )}
                </>
              ) : status === "anonymous" ? (
                <>
                  <LinkButton size="lg" href={`/login?next=${encodeURIComponent(returnTo)}`}>
                    {t.attend.signInToRegister}
                  </LinkButton>
                  <p className="text-[13px] text-muted">
                    {t.attend.signInNote}{" "}
                    <Link href={`/register?next=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand-ink hover:underline">
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
