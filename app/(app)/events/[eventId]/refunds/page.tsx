"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, CardHeader, Checkbox, Field, Input, PageLoader, Textarea } from "@/components/ui";
import { eventsApi } from "@/lib/api/endpoints";
import type { EventCancellation, RefundPolicy } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { isEventOver } from "@/lib/paidSales";
import { deadlineFor, MAX_DEADLINE_HOURS, parseDeadlineHours } from "@/lib/refunds";
import { formatMoney } from "@/lib/registration";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";

export default function RefundsPage() {
  const { t } = useI18n();
  const { event } = useEventContext();
  const { data: policy, error, reload } = useApi<RefundPolicy>(() => eventsApi.refundPolicy(event.id), [event.id]);

  return (
    <>
      <title>{`${t.refunds.tab} · ${event.title} — BiletFlow`}</title>
      {event.status === "CANCELLED" && <CancellationCard />}
      {error && !policy ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
        </Alert>
      ) : !policy ? (
        <PageLoader label={t.common.loading} />
      ) : (
        <PolicyCard policy={policy} />
      )}
    </>
  );
}

function PolicyCard({ policy }: { policy: RefundPolicy }) {
  const { t, intlLocale } = useI18n();
  const { event, setEvent } = useEventContext();
  const [enabled, setEnabled] = useState(policy.refunds_enabled);
  const [hours, setHours] = useState(policy.refund_deadline_hours ? String(policy.refund_deadline_hours) : "");
  const [text, setText] = useState(policy.policy_text ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const closed = isEventOver(event.status);
  const parsed = parseDeadlineHours(hours);
  const invalid = enabled && Number.isNaN(parsed);

  function edit<T>(set: (value: T) => void) {
    return (value: T) => {
      setNotice(null);
      set(value);
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    setNotice(null);
    try {
      const saved = await eventsApi.updateRefundPolicy(event.id, {
        refunds_enabled: enabled,
        // The number is kept while refunds are off, unless it cannot be saved.
        refund_deadline_hours: Number.isNaN(parsed) ? null : parsed,
        policy_text: text.trim() || null,
      });
      setEvent({ ...event, refund_policy: saved.policy_text });
      setNotice({ tone: "success", text: t.refunds.saved });
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="refunds-h">
      <CardHeader id="refunds-h" title={t.refunds.title} description={t.refunds.hint} />
      <Alert tone="info">{t.refunds.demo}</Alert>
      {closed && <Alert tone="warning">{t.refunds.over}</Alert>}
      <form onSubmit={save} noValidate>
        <fieldset disabled={closed || busy} className="flex flex-col gap-4">
          <legend className="sr-only">{t.refunds.title}</legend>
          <Checkbox label={t.refunds.enabled} checked={enabled} onChange={(e) => edit(setEnabled)(e.target.checked)} />
          {enabled && (
            <Field
              label={t.refunds.hours}
              optionalLabel={t.common.optional}
              hint={t.refunds.hoursHint}
              error={invalid ? fmt(t.refunds.hoursInvalid, { max: MAX_DEADLINE_HOURS }) : undefined}
              className="max-w-[420px]"
            >
              {(props) => <Input {...props} inputMode="numeric" value={hours} onChange={(e) => edit(setHours)(e.target.value)} maxLength={5} />}
            </Field>
          )}
          <p className="text-[15px] font-semibold">
            {!enabled
              ? t.refunds.offNote
              : invalid
                ? null
                : fmt(t.refunds.until, { date: formatDateTime(deadlineFor(event, parsed ?? 0), event.timezone, intlLocale) })}
          </p>
          <Field label={t.refunds.text} optionalLabel={t.common.optional}>
            {(props) => <Textarea {...props} rows={4} value={text} onChange={(e) => edit(setText)(e.target.value)} maxLength={10000} />}
          </Field>
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" loading={busy} disabled={closed || invalid}>{t.common.save}</Button>
            <Link href={`/events/${event.id}/attendees`} className="text-sm font-semibold text-brand-ink hover:underline">
              {t.attendees.tab}
            </Link>
          </div>
        </fieldset>
      </form>
    </Card>
  );
}

/** What cancelling the event did to its orders, and a way to finish if it was interrupted. */
function CancellationCard() {
  const { t, intlLocale } = useI18n();
  const { event, version } = useEventContext();
  const { data, error, reload } = useApi<EventCancellation>(() => eventsApi.cancellation(event.id), [event.id, version]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  async function resume() {
    setBusy(true);
    setActionError(null);
    try {
      await eventsApi.cancel(event.id);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Alert tone="error">{errorMessage(error, t)}</Alert>;
  if (!data) return <PageLoader label={t.common.loading} />;

  const stats = [
    [t.refunds.ordersRefunded, data.orders_refunded],
    [t.refunds.ordersCancelled, data.orders_cancelled],
    [t.refunds.refundTotal, formatMoney(data.event_cancellation_refund_total, "KZT", intlLocale)],
  ];
  return (
    <Card aria-labelledby="cancellation-h">
      <CardHeader
        id="cancellation-h"
        title={t.refunds.cancellationTitle}
        description={data.reason ? fmt(t.refunds.cancellationReason, { reason: data.reason }) : undefined}
      />
      <dl className="grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-bold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      {actionError !== null && <Alert tone="error">{errorMessage(actionError, t)}</Alert>}
      {data.complete ? (
        <Alert tone="success">{t.refunds.cancellationDone}</Alert>
      ) : (
        <>
          <Alert tone="warning">{fmt(t.refunds.cancellationLeft, { count: data.orders_remaining })}</Alert>
          <Button className="w-fit" loading={busy} onClick={resume}>{t.refunds.cancellationResume}</Button>
        </>
      )}
    </Card>
  );
}
