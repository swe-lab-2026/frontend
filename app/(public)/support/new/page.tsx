"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireAuth } from "@/components/support/RequireAuth";
import { Alert, BackLink, Button, Card, CardHeader, Field, Input, PageLoader, Select, Textarea } from "@/components/ui";
import { catalogApi, ordersApi, supportApi, ticketsApi } from "@/lib/api/endpoints";
import type { Event, Order, SupportCategory, Ticket } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { defaultCategory, MESSAGE_MAX, SUPPORT_CATEGORIES } from "@/lib/support";
import { useApi } from "@/lib/useApi";

type Context = { event: Event | null; order: Order | null; ticket: Ticket | null };

/** The most specific reference wins; the server derives the rest from it too. */
async function loadContext(ids: { event: string | null; order: string | null; ticket: string | null }): Promise<Context> {
  const ticket = ids.ticket ? await ticketsApi.get(ids.ticket) : null;
  const orderId = ticket?.order_id ?? ids.order;
  const order = orderId ? await ordersApi.get(orderId) : null;
  const eventId = ticket?.event_id ?? order?.event_id ?? ids.event;
  // A hidden event (e.g. suspended) must not stop a buyer from asking about
  // their order; without an order it is the context itself, so it must load.
  const event = eventId ? await (order ? catalogApi.event(eventId).catch(() => null) : catalogApi.event(eventId)) : null;
  return { event, order, ticket };
}

function NewCase() {
  const { t } = useI18n();
  const params = useSearchParams();
  const ids = { event: params.get("event"), order: params.get("order"), ticket: params.get("ticket") };
  const { data, error, reload } = useApi<Context>(() => loadContext(ids), [ids.event, ids.order, ids.ticket]);

  if (error) {
    return (
      <Alert tone="error">
        {errorMessage(error, t)}{" "}
        <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
      </Alert>
    );
  }
  if (!data) return <PageLoader label={t.common.loading} />;
  return <CaseForm context={data} />;
}

function CaseForm({ context }: { context: Context }) {
  const { t, intlLocale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const { event, order, ticket } = context;
  const [category, setCategory] = useState<SupportCategory>(() => defaultCategory(context));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasContext = Boolean(event || order || ticket);
  // Same routing rule as the server: own event or no event -> the platform.
  const toPlatform = !hasContext || event?.owner_user_id === user?.user_id;
  const title = event?.title ?? ticket?.event_title ?? order?.tickets[0]?.event_title;
  const startsAt = event?.starts_at ?? ticket?.event_starts_at;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: Record<string, string> = {};
    if (subject.trim().length < 3) found.subject = t.support.subjectShort;
    if (!message.trim()) found.message = t.validation.required;
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const created = await supportApi.create({
        subject: subject.trim(),
        category,
        message: message.trim(),
        // One reference is enough: the server resolves ticket -> order -> event.
        ...(ticket ? { ticket_id: ticket.ticket_id } : order ? { order_id: order.id } : event ? { event_id: event.id } : {}),
      });
      router.replace(`/support/${created.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err, t));
      setSubmitting(false);
    }
  }

  return (
    <Card aria-labelledby="new-case-h">
      <CardHeader as="h1" id="new-case-h" title={t.support.newTitle} description={toPlatform ? t.support.toPlatform : t.support.toOrganizer} />

      <section aria-labelledby="context-h" className="flex flex-col gap-2 rounded-xl bg-canvas p-4">
        <h3 id="context-h" className="text-sm font-semibold">{t.support.contextTitle}</h3>
        {hasContext ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {title && (
              <>
                <dt className="text-muted">{t.order.event}</dt>
                <dd className="font-semibold">
                  {title}
                  {startsAt && <span className="font-normal text-muted"> · {formatDateTime(startsAt, event?.timezone ?? ticket?.timezone ?? "Asia/Almaty", intlLocale)}</span>}
                </dd>
              </>
            )}
            {order && (
              <>
                <dt className="text-muted">{t.order.number}</dt>
                <dd>
                  <span className="font-mono">#{order.order_number}</span> · {(t.order.status as Record<string, string>)[order.status] ?? order.status}
                </dd>
              </>
            )}
            {ticket && (
              <>
                <dt className="text-muted">{t.support.ticket}</dt>
                <dd>
                  {ticket.ticket_type_name} · {(t.ticket.status as Record<string, string>)[ticket.status] ?? ticket.status}
                  <span className="block break-all font-mono text-[13px] text-muted">{ticket.public_id}</span>
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted">{t.support.noContext}</p>
        )}
      </section>

      {formError && <Alert tone="error">{formError}</Alert>}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t.support.category} error={errors.category}>
          {(props) => (
            <Select {...props} value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
              {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{t.support.categories[c]}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t.support.subject} error={errors.subject}>
          {(props) => <Input {...props} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={240} />}
        </Field>
        <Field label={t.support.message} error={errors.message} hint={t.support.messageHint}>
          {(props) => <Textarea {...props} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MESSAGE_MAX} />}
        </Field>
        <Button type="submit" size="lg" loading={submitting}>{t.support.submit}</Button>
      </form>
    </Card>
  );
}

export default function NewSupportCasePage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <title>{`${t.support.newTitle} — BiletFlow`}</title>
      <BackLink href="/support">{t.support.title}</BackLink>
      <Suspense>
        <RequireAuth>
          <NewCase />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
