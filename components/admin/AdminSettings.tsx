"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import { Alert, Button, Card, CardHeader, Field, Input, PageLoader } from "@/components/ui";
import { parseSetting } from "@/lib/adminFlow";
import { adminApi } from "@/lib/api/endpoints";
import type { PlatformSettings } from "@/lib/api/types";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { useApi } from "@/lib/useApi";

// The API's own limits.
const MAX_FEE = 10_000_000;
const MAX_PERCENT = 20;

export function AdminSettings() {
  const { t, intlLocale } = useI18n();
  const { data, error, reload, setData } = useApi<PlatformSettings>(adminApi.settings, []);
  const [saved, setSaved] = useState(false);

  return (
    <Card aria-labelledby="settings-h">
      <title>{`${t.admin.sections.settings} · ${t.admin.title} — BiletFlow`}</title>
      <CardHeader id="settings-h" title={t.admin.sections.settings} description={t.admin.settings.hint} />
      {saved && <Alert tone="success">{t.admin.settings.saved}</Alert>}
      {error && !data ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
        </Alert>
      ) : !data ? (
        <PageLoader label={t.common.loading} />
      ) : (
        <>
          {/* Keyed so the fields show exactly what the server stored. */}
          <SettingsForm
            key={data.updated_at}
            current={data}
            onEdit={() => setSaved(false)}
            onSaved={(next) => {
              setData(next);
              setSaved(true);
            }}
          />
          <p className="text-[13px] text-muted">{fmt(t.admin.settings.updated, { date: formatDateTime(data.updated_at, DEFAULT_TIMEZONE, intlLocale) })}</p>
        </>
      )}
    </Card>
  );
}

function SettingsForm({ current, onEdit, onSaved }: { current: PlatformSettings; onEdit: () => void; onSaved: (next: PlatformSettings) => void }) {
  const { t, intlLocale } = useI18n();
  const [fee, setFee] = useState(current.activation_fee_amount);
  const [percent, setPercent] = useState(current.processing_fee_percent);
  const [confirming, setConfirming] = useState(false);

  const newFee = parseSetting(fee, MAX_FEE);
  const newPercent = parseSetting(percent, MAX_PERCENT);
  const feeChanged = newFee !== null && Number(newFee) !== Number(current.activation_fee_amount);
  const percentChanged = newPercent !== null && Number(newPercent) !== Number(current.processing_fee_percent);
  const valid = newFee !== null && newPercent !== null;

  const money = (amount: string) => formatMoney(amount, current.activation_fee_currency, intlLocale);
  const changes = [
    feeChanged && `${t.admin.columns.fee}: ${money(current.activation_fee_amount)} → ${money(newFee)}`,
    percentChanged && `${t.admin.settings.processingPercent}: ${Number(current.processing_fee_percent)} → ${Number(newPercent)}`,
  ].filter(Boolean);

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && changes.length > 0) setConfirming(true);
        }}
      >
        <div className="flex flex-wrap gap-4">
          <Field
            label={fmt(t.admin.settings.activationFee, { currency: current.activation_fee_currency })}
            error={newFee === null ? fmt(t.admin.settings.invalidFee, { max: MAX_FEE }) : undefined}
            className="flex-[1_1_240px] sm:max-w-[320px]"
          >
            {(props) => <Input {...props} inputMode="decimal" value={fee} onChange={(e) => { onEdit(); setFee(e.target.value); }} maxLength={12} />}
          </Field>
          <Field
            label={t.admin.settings.processingPercent}
            error={newPercent === null ? fmt(t.admin.settings.invalidPercent, { max: MAX_PERCENT }) : undefined}
            className="flex-[1_1_240px] sm:max-w-[320px]"
          >
            {(props) => <Input {...props} inputMode="decimal" value={percent} onChange={(e) => { onEdit(); setPercent(e.target.value); }} maxLength={6} />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={!valid || changes.length === 0}>{t.admin.settings.review}</Button>
          {valid && changes.length === 0 && <span className="text-sm text-muted">{t.admin.settings.unchanged}</span>}
        </div>
      </form>
      {confirming && (
        <ReasonDialog
          title={t.admin.settings.confirmTitle}
          consequence={`${changes.join(". ")}. ${t.admin.settings.hint}`}
          confirmLabel={t.common.save}
          danger={false}
          onClose={() => setConfirming(false)}
          onConfirm={async (reason) => {
            const next = await adminApi.updateSettings({
              ...(feeChanged && { activation_fee_amount: newFee }),
              ...(percentChanged && { processing_fee_percent: newPercent }),
              reason,
            });
            setConfirming(false);
            onSaved(next);
          }}
        />
      )}
    </>
  );
}
