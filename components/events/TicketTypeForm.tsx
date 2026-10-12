"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, CrossIcon, Field, Input } from "@/components/ui";
import type { TicketType, TicketTypePayload } from "@/lib/api/types";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PRICE_RE } from "@/lib/validation";

// SRS §5: KZT is the only settlement currency in the initial release.
const CURRENCY = "KZT";

type Props = {
  ticketType?: TicketType;
  timeZone: string;
  onSubmit: (payload: TicketTypePayload) => Promise<void>;
  onClose: () => void;
};

export function TicketTypeForm({ ticketType, timeZone, onSubmit, onClose }: Props) {
  const { t } = useI18n();
  const [paid, setPaid] = useState(ticketType ? !ticketType.is_free : false);
  const [form, setForm] = useState({
    name: ticketType?.name ?? "",
    description: ticketType?.description ?? "",
    price: ticketType && !ticketType.is_free ? String(Number(ticketType.price)) : "",
    capacity: ticketType ? String(ticketType.capacity) : "",
    min_per_order: String(ticketType?.min_per_order ?? 1),
    max_per_order: String(ticketType?.max_per_order ?? 10),
    sales_starts_at: isoToLocalInput(ticketType?.sales_starts_at, timeZone),
    sales_ends_at: isoToLocalInput(ticketType?.sales_ends_at, timeZone),
    is_hidden: ticketType?.is_hidden ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function validate() {
    const v = t.validation;
    const next: Record<string, string> = {};
    const positiveInt = (value: string) => Number.isInteger(Number(value)) && Number(value) > 0;
    if (!form.name.trim()) next.name = v.required;
    if (paid && !PRICE_RE.test(form.price.replace(",", "."))) next.price = v.price;
    if (!positiveInt(form.capacity)) next.capacity = v.positive;
    if (!positiveInt(form.min_per_order)) next.min_per_order = v.positive;
    if (!positiveInt(form.max_per_order)) next.max_per_order = v.positive;
    else if (Number(form.max_per_order) < Number(form.min_per_order)) next.max_per_order = v.maxGteMin;
    if (form.sales_starts_at && form.sales_ends_at && form.sales_ends_at <= form.sales_starts_at) next.sales_ends_at = v.endAfterStart;
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: paid ? form.price.replace(",", ".") : "0",
        currency: CURRENCY,
        capacity: Number(form.capacity),
        min_per_order: Number(form.min_per_order),
        max_per_order: Number(form.max_per_order),
        sales_starts_at: localInputToIso(form.sales_starts_at, timeZone),
        sales_ends_at: localInputToIso(form.sales_ends_at, timeZone),
        is_hidden: form.is_hidden,
      });
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  }

  const segment = (active: boolean) =>
    `h-10 rounded-[9px] px-4 text-sm font-semibold ${active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted"}`;

  return (
    <section aria-labelledby="tt-form-h" className="flex flex-col gap-5 rounded-2xl border-2 border-[#cfe8d6] bg-surface p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 id="tt-form-h" className="text-xl font-bold">
          {ticketType ? t.tickets.editTitle : t.tickets.newTitle}
        </h2>
        <Button variant="ghost" className="w-11 px-0" aria-label={t.common.close} onClick={onClose}>
          <CrossIcon size={20} />
        </Button>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.tickets.name} error={errors.name}>
            {(props) => <Input {...props} value={form.name} onChange={set("name")} maxLength={120} />}
          </Field>
          <Field label={t.tickets.description} optionalLabel={t.common.optional} error={errors.description}>
            {(props) => <Input {...props} value={form.description} onChange={set("description")} maxLength={2000} />}
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div role="group" aria-label={t.tickets.priceType} className="flex rounded-xl bg-chip p-1">
            <button type="button" aria-pressed={!paid} onClick={() => setPaid(false)} className={segment(!paid)}>
              {t.tickets.free}
            </button>
            <button type="button" aria-pressed={paid} onClick={() => setPaid(true)} className={segment(paid)}>
              {t.tickets.paid}
            </button>
          </div>
          {paid && (
            <div className="flex items-end gap-2">
              <Field label={t.tickets.price} error={errors.price}>
                {(props) => <Input {...props} inputMode="decimal" value={form.price} onChange={set("price")} className={`${props.className} w-40`} />}
              </Field>
              <span className="flex h-12 items-center rounded-xl bg-canvas px-3.5 text-[15px] font-semibold text-ink-2">{CURRENCY}</span>
            </div>
          )}
        </div>
        {paid && <Alert tone="warning">{t.tickets.paidNote}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t.tickets.capacity} error={errors.capacity}>
            {(props) => <Input {...props} type="number" min={1} value={form.capacity} onChange={set("capacity")} />}
          </Field>
          <Field label={t.tickets.minPerOrder} error={errors.min_per_order}>
            {(props) => <Input {...props} type="number" min={1} value={form.min_per_order} onChange={set("min_per_order")} />}
          </Field>
          <Field label={t.tickets.maxPerOrder} error={errors.max_per_order}>
            {(props) => <Input {...props} type="number" min={1} value={form.max_per_order} onChange={set("max_per_order")} />}
          </Field>
          <Field label={t.tickets.salesStartsAt} optionalLabel={t.common.optional} error={errors.sales_starts_at}>
            {(props) => <Input {...props} type="datetime-local" value={form.sales_starts_at} onChange={set("sales_starts_at")} />}
          </Field>
          <Field label={t.tickets.salesEndsAt} optionalLabel={t.common.optional} error={errors.sales_ends_at}>
            {(props) => <Input {...props} type="datetime-local" value={form.sales_ends_at} onChange={set("sales_ends_at")} />}
          </Field>
          <div className="flex items-end">
            <Checkbox
              label={t.tickets.hideFromAttendees}
              checked={form.is_hidden}
              onChange={(e) => setForm((prev) => ({ ...prev, is_hidden: e.target.checked }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={submitting}>
            {ticketType ? t.common.save : t.tickets.addButton}
          </Button>
        </div>
      </form>
    </section>
  );
}
