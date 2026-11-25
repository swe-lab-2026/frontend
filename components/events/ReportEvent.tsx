"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { catalogApi } from "@/lib/api/endpoints";
import { type Event, REPORT_REASONS, type ReportReason } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";

const LINK = "w-fit text-sm font-semibold text-muted hover:text-ink hover:underline";

/** Not shown to the owner: the server refuses reports on one's own event. */
export function ReportEvent({ event }: { event: Event }) {
  const { t } = useI18n();
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (status === "anonymous") {
    return <Link href={`/login?next=${encodeURIComponent(`/catalog/${event.id}`)}`} className={LINK}>{t.reports.action}</Link>;
  }
  if (sent) {
    return (
      <Alert tone="success">
        {t.reports.sent}{" "}
        <Link href="/support/reports" className="font-semibold underline">{t.reports.mine}</Link>
      </Alert>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={LINK}>{t.reports.action}</button>
      {open && (
        <ReportDialog
          event={event}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            setSent(true);
          }}
        />
      )}
    </>
  );
}

function ReportDialog({ event, onClose, onSent }: { event: Event; onClose: () => void; onSent: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const missingDetails = reason === "OTHER" && !details.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || missingDetails) return;
    setBusy(true);
    setError(null);
    try {
      await catalogApi.report(event.id, reason, details.trim() || null);
      onSent();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="report-h"
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl bg-surface p-6 text-ink backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <h2 id="report-h" className="break-words text-xl font-bold">{fmt(t.reports.title, { name: event.title })}</h2>
        <p className="text-[15px] text-ink-2">{t.reports.hint}</p>
        {error !== null && <Alert tone="error">{errorMessage(error, t)}</Alert>}
        <Field label={t.reports.reason}>
          {(props) => (
            <Select {...props} value={reason} onChange={(e) => setReason(e.target.value as ReportReason | "")}>
              <option value="">{t.reports.choose}</option>
              {REPORT_REASONS.map((value) => <option key={value} value={value}>{t.reports.reasons[value]}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t.reports.details} optionalLabel={reason === "OTHER" ? undefined : t.common.optional} hint={missingDetails ? t.reports.detailsRequired : undefined}>
          {(props) => <Textarea {...props} rows={4} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />}
        </Field>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => ref.current?.close()}>{t.common.cancel}</Button>
          <Button type="submit" loading={busy} disabled={!reason || missingDetails}>{t.reports.submit}</Button>
        </div>
      </form>
    </dialog>
  );
}
