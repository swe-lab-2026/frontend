"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, CrossIcon, Field, Input, PageLoader } from "@/components/ui";
import { eventAdminsApi, eventsApi } from "@/lib/api/endpoints";
import type { EventAdmin, EventInventory, EventPreview } from "@/lib/api/types";
import { errorMessage, publishErrorLabel } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { EMAIL_RE } from "@/lib/validation";
import { useEventContext } from "./EventContext";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-surface p-5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-[30px] font-bold tracking-tight">{value}</span>
      {sub}
    </div>
  );
}

function InventoryStats() {
  const { t } = useI18n();
  const { event, version } = useEventContext();
  const { data: inventory } = useApi<EventInventory>(() => eventsApi.inventory(event.id), [event.id, version]);

  if (!inventory) return null;
  const capacity = inventory.event_capacity;
  const soldShare = capacity ? Math.min(100, Math.round((inventory.total_sold / capacity) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat
        label={t.inventory.totalSold}
        value={inventory.total_sold}
        sub={capacity ? <span className="text-[13px] text-muted">{fmt(t.inventory.ofCapacity, { capacity })}</span> : null}
      />
      <Stat label={t.inventory.totalReserved} value={inventory.total_reserved} sub={<span className="text-[13px] text-muted">{t.inventory.reservedHint}</span>} />
      <Stat
        label={t.inventory.totalAvailable}
        value={inventory.total_available}
        sub={
          capacity ? (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft" role="img" aria-label={`${soldShare}%`}>
              <div className="h-full bg-brand" style={{ width: `${soldShare}%` }} />
            </div>
          ) : null
        }
      />
    </div>
  );
}

function PublishChecklist() {
  const { t } = useI18n();
  const { event, version } = useEventContext();
  const { data: preview, error } = useApi<EventPreview>(() => eventsApi.preview(event.id), [event.id, version]);

  // Map each backend error back to the tab where it can be fixed.
  const fixHref = (message: string) => (message.includes("ticket type") ? `/events/${event.id}/tickets` : `/events/${event.id}/edit`);

  return (
    <section aria-labelledby="checklist-h" className="flex min-w-0 flex-[999_1_480px] flex-col gap-4 rounded-2xl bg-surface p-6">
      <h2 id="checklist-h" className="text-lg font-bold">{t.event.readiness}</h2>
      {error ? (
        <Alert tone="error">{errorMessage(error, t)}</Alert>
      ) : !preview ? (
        <PageLoader label={t.common.loading} />
      ) : preview.publish_ready ? (
        <Alert tone="success">{t.event.ready}</Alert>
      ) : (
        <>
          <p className="text-[15px] text-ink-2">{t.event.notReady}</p>
          <ul className="flex flex-col gap-1">
            {preview.validation_errors.map((message) => (
              <li key={message} className="flex items-center gap-3 px-1 py-2.5 text-[15px]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
                  <CrossIcon size={14} />
                </span>
                <span className="font-semibold">{publishErrorLabel(message, t)}</span>
                <Link href={fixHref(message)} className="ml-auto text-sm font-semibold text-brand-ink hover:underline">
                  {t.event.fix}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function EventAdmins() {
  const { t, intlLocale } = useI18n();
  const { event } = useEventContext();
  const { data: admins, error: loadError, reload } = useApi<EventAdmin[]>(() => eventAdminsApi.list(event.id), [event.id]);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setFieldError(t.validation.email);
      return;
    }
    setFieldError(undefined);
    setBusy("assign");
    try {
      await eventAdminsApi.assign(event.id, email.trim());
      setEmail("");
      reload();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(admin: EventAdmin) {
    if (!window.confirm(fmt(t.staff.confirmRemove, { email: admin.email }))) return;
    setBusy(admin.user_id);
    try {
      await eventAdminsApi.remove(event.id, admin.user_id);
      reload();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="staff" aria-labelledby="staff-h" className="flex flex-[1_1_320px] flex-col gap-4 rounded-2xl bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 id="staff-h" className="text-lg font-bold">{t.event.tabs.staff}</h2>
        <p className="text-[13px] leading-normal text-muted">{t.staff.hint}</p>
      </div>
      {Boolean(error || loadError) && <Alert tone="error">{error ?? errorMessage(loadError, t)}</Alert>}
      {!admins ? null : admins.length === 0 ? (
        <p className="text-sm text-muted">{t.staff.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {admins.map((admin) => (
            <li key={admin.user_id} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-[13px] font-bold text-info-ink" aria-hidden="true">
                {`${admin.first_name[0] ?? ""}${admin.last_name[0] ?? ""}`.toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">
                  {admin.first_name} {admin.last_name}
                </span>
                <span className="truncate text-[13px] text-muted" title={fmt(t.staff.assigned, { date: new Date(admin.assigned_at).toLocaleDateString(intlLocale) })}>
                  {admin.email}
                </span>
              </div>
              <Button variant="ghost" className="w-11 px-0" aria-label={`${t.common.remove}: ${admin.email}`} loading={busy === admin.user_id} onClick={() => handleRemove(admin)}>
                {busy !== admin.user_id && <CrossIcon />}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAssign} noValidate className="flex items-end gap-2 border-t border-line-soft pt-3">
        <Field label={t.staff.email} error={fieldError} className="flex-1">
          {(props) => <Input {...props} type="email" placeholder="name@nu.edu.kz" value={email} onChange={(e) => setEmail(e.target.value)} className={`${props.className} h-11`} />}
        </Field>
        <Button type="submit" variant="dark" loading={busy === "assign"} className={fieldError ? "mb-[26px]" : ""}>
          {t.staff.assign}
        </Button>
      </form>
    </section>
  );
}

function Notices() {
  const { t } = useI18n();
  const params = useSearchParams();
  if (params.get("created")) return <Alert tone="success">{t.event.created}</Alert>;
  if (params.get("duplicated")) return <Alert tone="success">{t.event.actions.duplicated}</Alert>;
  return null;
}

export default function EventOverviewPage() {
  return (
    <>
      <Suspense>
        <Notices />
      </Suspense>
      <InventoryStats />
      <div className="flex flex-wrap items-start gap-6">
        <PublishChecklist />
        <EventAdmins />
      </div>
    </>
  );
}
