"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, CheckIcon, Checkbox, LinkButton, PageLoader } from "@/components/ui";
import { fetchPayoutAccount, organizersApi, paidSalesApi, ticketTypesApi } from "@/lib/api/endpoints";
import type { OrganizerProfile, PaidSalesActivation, PayoutAccount, TicketType } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { canSimulateVerification, hasPaidTickets, isStepDone, payoutAction, remainingSteps, salesPhase, STEPS, type StepId } from "@/lib/paidSales";
import { formatMoney } from "@/lib/registration";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";

type Data = [PaidSalesActivation, TicketType[], OrganizerProfile, PayoutAccount | null];

export default function PaidSalesPage() {
  const { t, intlLocale } = useI18n();
  const { event, setEvent, version } = useEventContext();
  const load = (): Promise<Data> =>
    Promise.all([paidSalesApi.status(event.id), ticketTypesApi.list(event.id), organizersApi.me(), fetchPayoutAccount()]);
  const { data, error: loadError, reload, setData } = useApi<Data>(load, [event.id, version]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (loadError && !data) {
    return (
      <Alert tone="error">
        {errorMessage(loadError, t)}{" "}
        <button type="button" onClick={reload} className="font-semibold underline">
          {t.common.retry}
        </button>
      </Alert>
    );
  }
  if (!data) return <PageLoader label={t.common.loading} />;

  const [status, ticketTypes, profile, payout] = data;
  const phase = salesPhase(status, event.status, hasPaidTickets(ticketTypes));
  const missing = remainingSteps(status);
  // Nothing can be changed while the platform or the event's end blocks sales.
  const editable = phase === "incomplete" || phase === "ready";

  async function run(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    setError(null);
    try {
      await action();
      const fresh = await load();
      setData(fresh);
      // Keeps the notices on the other tabs in step with the new state.
      if (fresh[0].paid_sales_open !== event.paid_sales_active) setEvent({ ...event, paid_sales_active: fresh[0].paid_sales_open });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const demoButton = (name: string, label: string, action: () => Promise<unknown>) => (
    <Button variant="secondary" loading={busy === name} disabled={busy !== null} onClick={() => run(name, action)}>
      {label}
    </Button>
  );
  const contactPlatform = (
    <Link href={`/support/new?event=${event.id}`} className="text-sm font-semibold text-brand-ink underline">
      {t.support.contactPlatform}
    </Link>
  );

  function stepDetail(step: StepId): React.ReactNode {
    switch (step) {
      case "payout":
        return payout && fmt(t.profile.currentPayout, { provider: payout.provider, ref: payout.external_account_ref });
      case "fee":
        return fmt(t.paidSales.feeText, { amount: formatMoney(status.activation_fee_amount, "KZT", intlLocale) });
      case "verification":
        return t.paidSales.verificationText;
      case "terms":
        return t.paidSales.termsText;
    }
  }

  function stepAction(step: StepId): React.ReactNode {
    switch (step) {
      case "verification":
        return canSimulateVerification(profile.verification_status) ? (
          demoButton(step, t.paidSales.verify, organizersApi.simulateVerification)
        ) : (
          <div className="flex flex-col gap-1.5">
            <Alert tone="error">{t.paidSales.verificationRejected}</Alert>
            {contactPlatform}
          </div>
        );
      case "payout":
        switch (payoutAction(payout)) {
          case "add":
            return <LinkButton variant="secondary" href="/profile#payout">{t.paidSales.addPayout}</LinkButton>;
          case "approve":
            return demoButton(step, t.paidSales.approvePayout, organizersApi.simulatePayoutApproval);
          case "blocked":
            return (
              <div className="flex flex-col gap-1.5">
                <Alert tone="error">{t.paidSales.payoutBlocked}</Alert>
                {contactPlatform}
              </div>
            );
        }
        break;
      case "terms":
        return (
          <div className="flex flex-col items-start gap-2">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
              {t.paidSales.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
            <Checkbox label={t.paidSales.agree} checked={agreed} disabled={busy !== null} onChange={(e) => setAgreed(e.target.checked)} />
            <Button variant="secondary" loading={busy === step} disabled={!agreed || busy !== null} onClick={() => run(step, () => paidSalesApi.acceptTerms(event.id))}>
              {t.paidSales.accept}
            </Button>
          </div>
        );
      case "fee":
        return demoButton(
          step,
          fmt(t.paidSales.payFee, { amount: formatMoney(status.activation_fee_amount, "KZT", intlLocale) }),
          () => paidSalesApi.payFee(event.id),
        );
    }
  }

  return (
    <Card aria-labelledby="paid-sales-h">
      <title>{`${t.paidSales.tab} · ${event.title} — BiletFlow`}</title>
      <CardHeader
        id="paid-sales-h"
        title={t.paidSales.title}
        description={t.paidSales.hint}
        action={
          <Badge tone={phase === "open" ? "success" : phase === "stopped" || phase === "eventSuspended" ? "danger" : "neutral"}>
            {phase === "open" ? t.paidSales.statusOpen : phase === "stopped" || phase === "eventSuspended" ? t.paidSales.statusStopped : t.paidSales.statusInactive}
          </Badge>
        }
      />

      {phase === "open" && (
        <Alert tone="success">
          {status.activated_at
            ? fmt(t.paidSales.openSince, { date: formatDateTime(status.activated_at, event.timezone, intlLocale) })
            : t.paidSales.statusOpen}
        </Alert>
      )}
      {phase === "stopped" && (
        <Alert tone="error">
          {t.errors.PAID_SALES_SUSPENDED}
          {status.sales_suspension_reason && <> {fmt(t.paidSales.reason, { reason: status.sales_suspension_reason })}</>}{" "}
          <Link href={`/support/new?event=${event.id}`} className="font-semibold underline">{t.support.contactPlatform}</Link>
        </Alert>
      )}
      {phase === "over" && <Alert tone="info">{t.paidSales.over}</Alert>}
      {phase === "noPaidTickets" && (
        <Alert tone="info">
          {t.paidSales.noPaidTickets}{" "}
          <Link href={`/events/${event.id}/tickets`} className="font-semibold underline">{t.event.tabs.tickets}</Link>
        </Alert>
      )}
      {editable && <Alert tone="info">{t.paidSales.demoNotice}</Alert>}
      {error !== null && <Alert tone="error">{errorMessage(error, t)}</Alert>}

      {phase !== "noPaidTickets" && (
        <ol className="flex flex-col divide-y divide-line-soft">
          {STEPS.map((step, index) => {
            const done = isStepDone(step, status);
            return (
              <li key={step} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-brand-soft text-brand-ink" : "bg-chip text-ink-2"}`}
                >
                  {done ? <CheckIcon size={16} /> : index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-base font-semibold">
                      {t.paidSales.steps[step]}
                      <span className="sr-only"> — {done ? t.paidSales.done : t.paidSales.notDone}</span>
                    </h3>
                    <p className="text-sm text-muted">{stepDetail(step)}</p>
                  </div>
                  {!done && editable && stepAction(step)}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-5">
          <Button size="lg" loading={busy === "activate"} disabled={phase !== "ready" || busy !== null} onClick={() => run("activate", () => paidSalesApi.activate(event.id))}>
            {t.paidSales.activate}
          </Button>
          <p className="text-[13px] text-muted">
            {missing.length > 0
              ? fmt(t.paidSales.remaining, { steps: missing.map((step) => t.paidSales.steps[step]).join(", ") })
              : t.paidSales.onlyThisEvent}
          </p>
        </div>
      )}
    </Card>
  );
}
