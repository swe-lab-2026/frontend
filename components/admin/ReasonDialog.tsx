"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  title: string;
  /** What exactly will happen, in words. */
  consequence: string;
  confirmLabel: string;
  danger: boolean;
  /** The reason may be left empty. */
  optional?: boolean;
  hint?: string;
  maxLength?: number;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
};

/** Explicit confirmation with a reason; the reason is stored in the audit log. */
export function ReasonDialog({ title, consequence, confirmLabel, danger, optional = false, hint, maxLength = 1000, onConfirm, onClose }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="reason-h"
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl bg-surface p-6 text-ink backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="reason-h" className="break-words text-xl font-bold">{title}</h2>
        <p className="text-[15px] text-ink-2">{consequence}</p>
        {error !== null && <Alert tone="error">{errorMessage(error, t)}</Alert>}
        <Field label={t.admin.reason} hint={hint ?? t.admin.reasonHint} optionalLabel={optional ? t.common.optional : undefined}>
          {(props) => <Textarea {...props} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={maxLength} />}
        </Field>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => ref.current?.close()}>{t.common.cancel}</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={!optional && reason.trim().length < 3}>{confirmLabel}</Button>
        </div>
      </form>
    </dialog>
  );
}
