"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, CrossIcon, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import type { CampaignPayload, TicketType } from "@/lib/api/types";
import { type CampaignForm as Form, validateCampaign } from "@/lib/campaigns";
import { localInputToIso } from "@/lib/datetime";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  ticketTypes: TicketType[];
  timeZone: string;
  onSubmit: (payload: CampaignPayload) => Promise<void>;
  onClose: () => void;
};

const EMPTY: Form = {
  name: "",
  code: "",
  discount_type: "PERCENT",
  discount_value: "",
  starts_at: "",
  expires_at: "",
  redemption_limit: "",
  limitTypes: false,
  ticket_type_ids: [],
};

export function CampaignForm({ ticketTypes, timeZone, onSubmit, onClose }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A discount on a free ticket changes nothing, so only paid types are offered.
  const paidTypes = ticketTypes.filter((tt) => !tt.is_free);
  const set = (key: "name" | "code" | "discount_value" | "starts_at" | "expires_at" | "redemption_limit") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const messages = { ...t.validation, code: t.promo.codeFormat };
    const found = Object.fromEntries(Object.entries(validateCampaign(form)).map(([field, code]) => [field, messages[code]]));
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: form.discount_value.replace(",", "."),
        starts_at: localInputToIso(form.starts_at, timeZone),
        expires_at: localInputToIso(form.expires_at, timeZone),
        redemption_limit: form.redemption_limit ? Number(form.redemption_limit) : null,
        ticket_type_ids: form.limitTypes ? form.ticket_type_ids : [],
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "PROMO_CODE_TAKEN") setErrors({ code: t.errors.PROMO_CODE_TAKEN });
      else {
        setErrors(fieldErrors(error));
        setFormError(errorMessage(error, t));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const segment = (active: boolean) =>
    `h-10 rounded-[9px] px-4 text-sm font-semibold ${active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-muted"}`;

  return (
    <section aria-labelledby="campaign-form-h" className="flex flex-col gap-5 rounded-2xl border-2 border-[#cfe8d6] bg-surface p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 id="campaign-form-h" className="text-xl font-bold">{t.campaigns.newTitle}</h2>
        <Button variant="ghost" className="w-11 px-0" aria-label={t.common.close} onClick={onClose}>
          <CrossIcon size={20} />
        </Button>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.campaigns.name} error={errors.name}>
            {(props) => <Input {...props} value={form.name} onChange={set("name")} maxLength={160} />}
          </Field>
          <Field label={t.campaigns.code} error={errors.code} hint={t.promo.codeFormat}>
            {(props) => <Input {...props} value={form.code} onChange={set("code")} maxLength={40} autoComplete="off" className={`${props.className} uppercase`} />}
          </Field>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div role="group" aria-label={t.campaigns.discountType} className="mt-[26px] flex rounded-xl bg-chip p-1">
            {(["PERCENT", "FIXED"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.discount_type === type}
                onClick={() => setForm((prev) => ({ ...prev, discount_type: type }))}
                className={segment(form.discount_type === type)}
              >
                {t.campaigns.types[type]}
              </button>
            ))}
          </div>
          <Field
            label={form.discount_type === "PERCENT" ? t.campaigns.percentValue : t.campaigns.fixedValue}
            error={errors.discount_value}
            hint={form.discount_type === "FIXED" ? t.campaigns.fixedHint : undefined}
          >
            {(props) => <Input {...props} inputMode="decimal" value={form.discount_value} onChange={set("discount_value")} className={`${props.className} max-w-48`} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t.campaigns.startsAt} optionalLabel={t.common.optional} error={errors.starts_at}>
            {(props) => <Input {...props} type="datetime-local" value={form.starts_at} onChange={set("starts_at")} />}
          </Field>
          <Field label={t.campaigns.expiresAt} optionalLabel={t.common.optional} error={errors.expires_at}>
            {(props) => <Input {...props} type="datetime-local" value={form.expires_at} onChange={set("expires_at")} />}
          </Field>
          <Field label={t.campaigns.limit} optionalLabel={t.common.optional} error={errors.redemption_limit}>
            {(props) => <Input {...props} type="number" min={1} value={form.redemption_limit} onChange={set("redemption_limit")} />}
          </Field>
        </div>

        {paidTypes.length === 0 ? (
          <Alert tone="warning">{t.campaigns.noPaidTypes}</Alert>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-semibold">{t.campaigns.appliesTo}</legend>
            <Checkbox label={t.campaigns.onlySome} checked={form.limitTypes} onChange={(e) => setForm((prev) => ({ ...prev, limitTypes: e.target.checked }))} />
            {form.limitTypes && (
              <div className="flex flex-col pl-7">
                {paidTypes.map((tt) => (
                  <Checkbox
                    key={tt.id}
                    label={tt.name}
                    checked={form.ticket_type_ids.includes(tt.id)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ticket_type_ids: e.target.checked ? [...prev.ticket_type_ids, tt.id] : prev.ticket_type_ids.filter((id) => id !== tt.id),
                      }))
                    }
                  />
                ))}
              </div>
            )}
            {errors.ticket_type_ids && <span role="alert" className="text-[13px] text-danger-ink">{errors.ticket_type_ids}</span>}
          </fieldset>
        )}

        <p className="text-[13px] text-muted">{t.campaigns.lockedNote}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={submitting}>
            {t.campaigns.createButton}
          </Button>
        </div>
      </form>
    </section>
  );
}
