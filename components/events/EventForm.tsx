"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Input, LinkButton, PlusIcon, Select, Textarea } from "@/components/ui";
import type { Event, EventPayload, EventVisibility } from "@/lib/api/types";
import { DEFAULT_TIMEZONE, TIMEZONES, isoToLocalInput, localInputToIso, zoneOffsetMinutes } from "@/lib/datetime";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Stored as stable slugs so the value does not depend on the UI language.
export const CATEGORIES = ["education", "concert", "theatre", "sport", "comedy", "exhibition", "conference", "other"] as const;
const VISIBILITIES: EventVisibility[] = ["PUBLIC", "UNLISTED", "PRIVATE"];

type ImageRow = { object_key: string; alt_text: string };

type FormState = {
  title: string;
  description: string;
  category: string;
  visibility: EventVisibility;
  venue_name: string;
  venue_address: string;
  city: string;
  country_code: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  registration_starts_at: string;
  registration_ends_at: string;
  capacity: string;
  refund_policy: string;
  images: ImageRow[];
};

function initialState(event?: Event): FormState {
  const tz = event?.timezone ?? DEFAULT_TIMEZONE;
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? "",
    visibility: event?.visibility ?? "PUBLIC",
    venue_name: event?.venue_name ?? "",
    venue_address: event?.venue_address ?? "",
    city: event?.city ?? "",
    country_code: event?.country_code ?? "KZ",
    timezone: tz,
    starts_at: isoToLocalInput(event?.starts_at, tz),
    ends_at: isoToLocalInput(event?.ends_at, tz),
    registration_starts_at: isoToLocalInput(event?.registration_starts_at, tz),
    registration_ends_at: isoToLocalInput(event?.registration_ends_at, tz),
    capacity: event?.capacity ? String(event.capacity) : "",
    refund_policy: event?.refund_policy ?? "",
    images: (event?.images ?? []).map((img) => ({ object_key: img.object_key, alt_text: img.alt_text ?? "" })),
  };
}

function tzLabel(tz: string): string {
  const minutes = zoneOffsetMinutes(new Date(), tz);
  const sign = minutes >= 0 ? "+" : "−";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${tz} (UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})`;
}

type Props = {
  event?: Event;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (payload: EventPayload) => Promise<void>;
};

export function EventForm({ event, submitLabel, cancelHref, onSubmit }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => initialState(event));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setImage = (index: number, key: keyof ImageRow, value: string) =>
    setForm((prev) => ({ ...prev, images: prev.images.map((img, i) => (i === index ? { ...img, [key]: value } : img)) }));

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const v = t.validation;
    if (!form.title.trim()) next.title = v.required;
    if (!form.starts_at) next.starts_at = v.required;
    if (!form.ends_at) next.ends_at = v.required;
    // datetime-local strings in the same zone compare correctly as strings.
    if (form.starts_at && form.ends_at && form.ends_at <= form.starts_at) next.ends_at = v.endAfterStart;
    if (form.registration_starts_at && form.registration_ends_at && form.registration_ends_at <= form.registration_starts_at) {
      next.registration_ends_at = v.endAfterStart;
    }
    if (form.capacity && !(Number.isInteger(Number(form.capacity)) && Number(form.capacity) > 0)) next.capacity = v.positive;
    if (form.country_code && !/^[A-Za-z]{2}$/.test(form.country_code)) next.country_code = v.countryCode;
    return next;
  }

  function toPayload(): EventPayload {
    const tz = form.timezone;
    const text = (value: string) => value.trim() || null;
    return {
      title: form.title.trim(),
      description: text(form.description),
      category: text(form.category),
      visibility: form.visibility,
      venue_name: text(form.venue_name),
      venue_address: text(form.venue_address),
      city: text(form.city),
      country_code: form.country_code ? form.country_code.toUpperCase() : null,
      timezone: tz,
      starts_at: localInputToIso(form.starts_at, tz)!,
      ends_at: localInputToIso(form.ends_at, tz)!,
      registration_starts_at: localInputToIso(form.registration_starts_at, tz),
      registration_ends_at: localInputToIso(form.registration_ends_at, tz),
      capacity: form.capacity ? Number(form.capacity) : null,
      refund_policy: text(form.refund_policy),
      images: form.images
        .filter((img) => img.object_key.trim())
        .map((img, index) => ({ object_key: img.object_key.trim(), alt_text: img.alt_text.trim() || null, sort_order: index })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError(t.errors.VALIDATION_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(toPayload());
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  }

  const categoryOptions = form.category && !(CATEGORIES as readonly string[]).includes(form.category) ? [...CATEGORIES, form.category] : CATEGORIES;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Card aria-labelledby="ev-basics">
          <h2 id="ev-basics" className="text-xl font-bold">{t.event.basics}</h2>
          <Field label={t.event.title} error={errors.title}>
            {(props) => <Input {...props} value={form.title} onChange={set("title")} maxLength={200} />}
          </Field>
          <Field label={t.event.description} error={errors.description}>
            {(props) => <Textarea {...props} rows={5} value={form.description} onChange={set("description")} maxLength={10000} />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.event.category} error={errors.category}>
              {(props) => (
                <Select {...props} value={form.category} onChange={set("category")}>
                  <option value="">—</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {(t.categories as Record<string, string>)[c] ?? c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-semibold">{t.event.visibility}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {VISIBILITIES.map((v) => {
                const active = form.visibility === v;
                return (
                  <label
                    key={v}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl p-3.5 ${
                      active ? "border-2 border-brand bg-[#f3faf5]" : "border border-field bg-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={v}
                      checked={active}
                      onChange={() => setForm((prev) => ({ ...prev, visibility: v }))}
                      className="mt-0.5 h-[18px] w-[18px] accent-brand"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-[15px] font-semibold">{t.visibility[v]}</span>
                      <span className="text-[13px] leading-snug text-muted">{t.visibilityHint[v]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <Card aria-labelledby="ev-venue">
          <h2 id="ev-venue" className="text-xl font-bold">{t.event.venueSection}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.event.venueName} error={errors.venue_name}>
              {(props) => <Input {...props} value={form.venue_name} onChange={set("venue_name")} maxLength={200} />}
            </Field>
            <Field label={t.event.city} error={errors.city}>
              {(props) => <Input {...props} value={form.city} onChange={set("city")} maxLength={120} />}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label={t.event.venueAddress} error={errors.venue_address} className="sm:col-span-3">
              {(props) => <Input {...props} value={form.venue_address} onChange={set("venue_address")} maxLength={2000} />}
            </Field>
            <Field label={t.event.countryCode} error={errors.country_code}>
              {(props) => <Input {...props} value={form.country_code} onChange={set("country_code")} maxLength={2} className={`${props.className} uppercase`} />}
            </Field>
          </div>
        </Card>

        <Card aria-labelledby="ev-schedule">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="ev-schedule" className="text-xl font-bold">{t.event.scheduleSection}</h2>
            <Field label={t.event.timezone} error={errors.timezone} className="min-w-[240px]">
              {(props) => (
                <Select {...props} value={form.timezone} onChange={set("timezone")} className={`${props.className} h-11`}>
                  {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((tz) => (
                    <option key={tz} value={tz}>
                      {tzLabel(tz)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.event.startsAt} error={errors.starts_at}>
              {(props) => <Input {...props} type="datetime-local" value={form.starts_at} onChange={set("starts_at")} />}
            </Field>
            <Field label={t.event.endsAt} error={errors.ends_at}>
              {(props) => <Input {...props} type="datetime-local" value={form.ends_at} onChange={set("ends_at")} />}
            </Field>
            <Field label={t.event.registrationStartsAt} error={errors.registration_starts_at}>
              {(props) => <Input {...props} type="datetime-local" value={form.registration_starts_at} onChange={set("registration_starts_at")} />}
            </Field>
            <Field label={t.event.registrationEndsAt} error={errors.registration_ends_at}>
              {(props) => <Input {...props} type="datetime-local" value={form.registration_ends_at} onChange={set("registration_ends_at")} />}
            </Field>
          </div>
        </Card>

        <Card aria-labelledby="ev-capacity">
          <h2 id="ev-capacity" className="text-xl font-bold">{t.event.capacitySection}</h2>
          <Field label={t.event.capacity} error={errors.capacity} className="max-w-[280px]">
            {(props) => <Input {...props} type="number" min={1} step={1} value={form.capacity} onChange={set("capacity")} />}
          </Field>
          <Field label={t.event.refundPolicy} error={errors.refund_policy}>
            {(props) => <Textarea {...props} rows={3} value={form.refund_policy} onChange={set("refund_policy")} maxLength={10000} />}
          </Field>
        </Card>

        <Card aria-labelledby="ev-images">
          <div className="flex flex-col gap-1">
            <h2 id="ev-images" className="text-xl font-bold">{t.event.imagesSection}</h2>
            <p className="text-sm text-muted">{t.event.imagesHint}</p>
          </div>
          {form.images.map((img, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3">
              <Field label={t.event.imageUrl} className="flex-[2_1_240px]">
                {(props) => <Input {...props} type="url" placeholder="https://…" value={img.object_key} onChange={(e) => setImage(index, "object_key", e.target.value)} maxLength={512} />}
              </Field>
              <Field label={t.event.imageAlt} className="flex-[1_1_180px]">
                {(props) => <Input {...props} value={img.alt_text} onChange={(e) => setImage(index, "alt_text", e.target.value)} maxLength={240} />}
              </Field>
              <Button
                variant="ghost"
                className="h-12"
                onClick={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))}
              >
                {t.common.remove}
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            className="w-fit border-dashed"
            onClick={() => setForm((prev) => ({ ...prev, images: [...prev.images, { object_key: "", alt_text: "" }] }))}
          >
            <PlusIcon size={16} />
            {t.event.addImage}
          </Button>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <LinkButton href={cancelHref} variant="secondary" size="lg" className="h-[52px]">
            {t.common.cancel}
          </LinkButton>
          <Button type="submit" size="lg" loading={submitting} className="h-[52px]">
            {submitting ? t.common.saving : submitLabel}
          </Button>
        </div>
      </form>

      <aside aria-labelledby="ev-help" className="flex flex-[1_1_280px] flex-col gap-4 rounded-2xl bg-surface p-6">
        <h2 id="ev-help" className="text-[17px] font-bold">{t.event.howToPublish}</h2>
        <ol className="flex flex-col gap-3.5">
          {[t.event.step1, t.event.step2, t.event.step3].map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  i === 0 ? "bg-brand text-white" : "bg-chip text-ink-2"
                }`}
              >
                {i + 1}
              </span>
              <span className="pt-1 text-sm leading-normal">{step}</span>
            </li>
          ))}
        </ol>
        <p className="border-t border-line-soft pt-3 text-[13px] leading-normal text-muted">{t.event.timezoneNote}</p>
      </aside>
    </div>
  );
}
