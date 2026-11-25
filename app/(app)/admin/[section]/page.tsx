"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { AdminCampaigns } from "@/components/admin/AdminCampaigns";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { type AdminSection, AdminTable } from "@/components/admin/AdminTable";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import { Alert, Badge, Button } from "@/components/ui";
import { canDispute, disputeMoves, reportMoves } from "@/lib/adminFlow";
import { adminApi } from "@/lib/api/endpoints";
import { type AdminDispute, type AdminEvent, type AdminEventReport, type AdminPayment, type AdminPayoutAccount, type AdminUser, REPORT_REASONS } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { campaignTone, discountLabel } from "@/lib/campaigns";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { reportTone, supportTone } from "@/lib/support";
import { orderTone } from "@/lib/tickets";
import { ADMIN_SECTIONS, type AdminSectionKey } from "../sections";

/** Grows with its label: some translations need two lines in a narrow column. */
const ACTION = "!h-auto min-h-10 px-3 py-2 text-sm leading-tight";

type Dialog = { title: string; consequence: string; confirmLabel: string; danger: boolean; run: (reason: string) => Promise<string>; reload: () => void };

export default function AdminSectionPage() {
  const { section } = useParams<{ section: string }>();
  if (!(ADMIN_SECTIONS as readonly string[]).includes(section)) notFound();
  // Keyed so that search, filter and paging never leak between sections.
  return <Section key={section} name={section as AdminSectionKey} />;
}

function Section({ name }: { name: AdminSectionKey }) {
  const { t, intlLocale } = useI18n();
  const { user: me } = useAuth();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const date = (iso: string | null) => (iso ? formatDateTime(iso, DEFAULT_TIMEZONE, intlLocale) : "");
  const money = (amount: string, currency: string) => formatMoney(amount, currency, intlLocale);
  const label = (map: object, value: string) => (map as Record<string, string>)[value] ?? value;
  const options = (map: object, values: string[]) => values.map((value) => ({ value, label: label(map, value) }));
  const c = t.admin.columns;

  const suspendUser = (row: AdminUser, reload: () => void) => {
    if (row.user_id === me?.user_id || row.global_role === "PLATFORM_ADMIN" || row.status === "DELETED") return null;
    const suspended = row.status === "BLOCKED";
    return (
      <Button
        variant={suspended ? "secondary" : "danger-outline"}
        className={ACTION}
        onClick={() =>
          setDialog({
            reload,
            title: fmt(suspended ? t.admin.unsuspendUser : t.admin.suspendUser, { name: row.email }),
            consequence: suspended ? t.admin.unsuspendUserText : t.admin.suspendUserText,
            confirmLabel: suspended ? t.admin.unsuspend : t.admin.suspend,
            danger: !suspended,
            run: async (reason) => {
              await (suspended ? adminApi.unsuspendUser(row.user_id, reason) : adminApi.suspendUser(row.user_id, reason));
              return fmt(suspended ? t.admin.unsuspended : t.admin.suspended, { name: row.email });
            },
          })
        }
      >
        {suspended ? t.admin.unsuspend : t.admin.suspend}
      </Button>
    );
  };

  const userActions = (row: AdminUser, reload: () => void) => {
    const name = row.organizer_display_name ?? row.email;
    const verification = row.organizer_verification_status;
    return (
      <div className="flex flex-col items-end gap-1.5">
        {suspendUser(row, reload)}
        {row.is_organizer &&
          (["VERIFIED", "REJECTED"] as const)
            .filter((target) => target !== verification)
            .map((target) => {
              const approve = target === "VERIFIED";
              return (
                <Button
                  key={target}
                  variant="ghost"
                  className={ACTION}
                  aria-label={`${approve ? t.admin.verify : t.admin.reject}: ${name}`}
                  onClick={() =>
                    setDialog({
                      reload,
                      title: fmt(approve ? t.admin.verifyTitle : t.admin.rejectTitle, { name }),
                      consequence: approve ? t.admin.verifyText : t.admin.rejectText,
                      confirmLabel: approve ? t.admin.verify : t.admin.reject,
                      danger: !approve,
                      run: async (reason) => {
                        await adminApi.setVerification(row.user_id, target, reason);
                        return fmt(approve ? t.admin.verified : t.admin.rejected, { name });
                      },
                    })
                  }
                >
                  {approve ? t.admin.verify : t.admin.reject}
                </Button>
              );
            })}
      </div>
    );
  };

  const payoutActions = (row: AdminPayoutAccount, reload: () => void) => {
    const name = row.organizer.name || row.organizer_email || row.organizer.id;
    const account = `${row.provider} · ${row.external_account_ref}`;
    return (
      <div className="flex flex-col items-end gap-1.5">
        {(["ACTIVE", "BLOCKED"] as const)
          .filter((target) => target !== row.status)
          .map((target) => {
            const approve = target === "ACTIVE";
            const action = approve ? t.admin.approvePayout : t.admin.blockPayout;
            return (
              <Button
                key={target}
                variant={approve ? "secondary" : "danger-outline"}
                className={ACTION}
                aria-label={`${action}: ${name}, ${account}`}
                onClick={() =>
                  setDialog({
                    reload,
                    title: fmt(approve ? t.admin.approvePayoutTitle : t.admin.blockPayoutTitle, { name }),
                    consequence: fmt(approve ? t.admin.approvePayoutText : t.admin.blockPayoutText, { account }),
                    confirmLabel: action,
                    danger: !approve,
                    run: async (reason) => {
                      await adminApi.setPayoutStatus(row.id, target, reason);
                      return fmt(t.admin.payoutChanged, { name, status: t.payoutStatus[target] });
                    },
                  })
                }
              >
                {action}
              </Button>
            );
          })}
      </div>
    );
  };

  const paymentActions = (row: AdminPayment, reload: () => void) =>
    canDispute(row.status) && (
      <Button
        variant="ghost"
        className={ACTION}
        onClick={() =>
          setDialog({
            reload,
            title: fmt(t.admin.openDisputeTitle, { id: row.id.slice(0, 8) }),
            consequence: fmt(t.admin.openDisputeText, { amount: money(row.amount, row.currency) }),
            confirmLabel: t.admin.openDispute,
            danger: false,
            run: async (reason) => {
              await adminApi.openDispute(row.id, reason);
              return t.admin.disputeOpened;
            },
          })
        }
      >
        {t.admin.openDispute}
      </Button>
    );

  /** One step of a review: closing it asks for a note, the rest happens at once. */
  const move = (target: string, name: string, statusLabel: string, final: boolean, reload: () => void, run: (note?: string) => Promise<unknown>) => {
    const action = label(t.admin.moves, target);
    return (
      <Button
        key={target}
        variant={target === "RESOLVED" ? "secondary" : "ghost"}
        className={ACTION}
        onClick={async () => {
          if (final) {
            setDialog({
              reload,
              title: fmt(t.admin.moveTitle, { action, name }),
              consequence: t.admin.moveText,
              confirmLabel: action,
              danger: false,
              run: async (note) => {
                await run(note);
                return fmt(t.admin.moved, { name, status: statusLabel });
              },
            });
            return;
          }
          setNotice(null);
          try {
            await run();
            setNotice({ tone: "success", text: fmt(t.admin.moved, { name, status: statusLabel }) });
          } catch (err) {
            setNotice({ tone: "error", text: errorMessage(err, t) });
          }
          reload();
        }}
      >
        {action}
      </Button>
    );
  };

  const disputeActions = (row: AdminDispute, reload: () => void) => (
    <div className="flex flex-col items-end gap-1.5">
      {disputeMoves(row.status).map((target) =>
        move(target, row.id.slice(0, 8), t.admin.disputeStatus[target], target === "RESOLVED" || target === "REJECTED", reload, (note) =>
          adminApi.updateDispute(row.id, target, note),
        ),
      )}
    </div>
  );

  const reportActions = (row: AdminEventReport, reload: () => void) => {
    const moves = reportMoves(row.status);
    return (
      <div className="flex flex-col items-end gap-1.5">
        {moves.includes("RESOLVED") && !row.event_is_suspended && (
          <Button
            variant="danger-outline"
            className={ACTION}
            onClick={() =>
              setDialog({
                reload,
                title: fmt(t.admin.suspendEvent, { name: row.event.title }),
                consequence: t.admin.resolveSuspendText,
                confirmLabel: t.admin.resolveSuspend,
                danger: true,
                run: async (note) => {
                  await adminApi.updateReport(row.id, "RESOLVED", note, true);
                  return fmt(t.admin.suspended, { name: row.event.title });
                },
              })
            }
          >
            {t.admin.resolveSuspend}
          </Button>
        )}
        {moves.map((target) =>
          move(target, row.event.title, t.reports.status[target], target === "RESOLVED" || target === "DISMISSED", reload, (note) =>
            adminApi.updateReport(row.id, target, note),
          ),
        )}
      </div>
    );
  };

  const eventActions = (row: AdminEvent, reload: () => void) => (
    <div className="flex flex-col items-end gap-1.5">
      {(row.is_suspended || (row.status !== "CANCELLED" && row.status !== "COMPLETED")) && (
        <Button
          variant={row.is_suspended ? "secondary" : "danger-outline"}
          className={ACTION}
          onClick={() =>
            setDialog({
              reload,
              title: fmt(row.is_suspended ? t.admin.unsuspendEvent : t.admin.suspendEvent, { name: row.title }),
              consequence: row.is_suspended ? t.admin.unsuspendEventText : t.admin.suspendEventText,
              confirmLabel: row.is_suspended ? t.admin.unsuspend : t.admin.suspend,
              danger: !row.is_suspended,
              run: async (reason) => {
                const result = await (row.is_suspended ? adminApi.unsuspendEvent(row.id, reason) : adminApi.suspendEvent(row.id, reason));
                return row.is_suspended
                  ? fmt(t.admin.unsuspended, { name: row.title })
                  : fmt(t.admin.eventSuspended, { name: row.title, pending: result.pending_orders, confirmed: result.confirmed_orders });
              },
            })
          }
        >
          {row.is_suspended ? t.admin.unsuspend : t.admin.suspend}
        </Button>
      )}
      {row.paid_sales_activated && (
        <Button
          variant="ghost"
          className={ACTION}
          onClick={() =>
            setDialog({
              reload,
              title: fmt(row.paid_sales_suspended ? t.admin.resumeSales : t.admin.stopSales, { name: row.title }),
              consequence: row.paid_sales_suspended ? t.admin.resumeSalesText : t.admin.stopSalesText,
              confirmLabel: row.paid_sales_suspended ? t.admin.resume : t.admin.stop,
              danger: !row.paid_sales_suspended,
              run: async (reason) => {
                await (row.paid_sales_suspended ? adminApi.resumePaidSales(row.id, reason) : adminApi.stopPaidSales(row.id, reason));
                return fmt(row.paid_sales_suspended ? t.admin.salesResumed : t.admin.salesStopped, { name: row.title });
              },
            })
          }
        >
          {row.paid_sales_suspended ? t.admin.resumeSalesShort : t.admin.stopSalesShort}
        </Button>
      )}
    </div>
  );

  const orderStatuses = ["PENDING", "PAID", "CONFIRMED", "EXPIRED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED"];
  const paymentStatuses = ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"];

  function table() {
    switch (name) {
      case "users":
        return define({
          key: name,
          title: t.admin.sections.users,
          load: adminApi.users,
          serverExport: "users",
          rowKey: (r) => r.user_id,
          searchHint: t.admin.searchUsers,
          filters: [{ param: "status", label: c.status, options: options(t.admin.userStatus, ["ACTIVE", "BLOCKED", "DELETED"]) }],
          columns: [
            { label: c.email, value: (r) => r.email },
            { label: c.name, value: (r) => `${r.first_name} ${r.last_name}`.trim() },
            { label: c.role, value: (r) => label(t.admin.roles, r.global_role) },
            { label: c.organizer, value: (r) => r.organizer_display_name ?? "" },
            { label: t.profile.verificationStatus, value: (r) => (r.organizer_verification_status ? label(t.verification, r.organizer_verification_status) : "") },
            {
              label: c.status,
              value: (r) => label(t.admin.userStatus, r.status),
              render: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : r.status === "BLOCKED" ? "danger" : "neutral"}>{label(t.admin.userStatus, r.status)}</Badge>,
            },
            { label: t.admin.reason, value: (r) => r.suspension_reason ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
          ],
          actions: userActions,
        });
      case "events":
        return define({
          key: name,
          title: t.admin.sections.events,
          load: adminApi.events,
          serverExport: "events",
          rowKey: (r) => r.id,
          searchHint: t.admin.searchEvents,
          filters: [{ param: "status", label: c.status, options: options(t.status, ["DRAFT", "PUBLISHED", "UNPUBLISHED", "CANCELLED", "COMPLETED"]) }],
          columns: [
            { label: c.event, value: (r) => r.title, render: (r) => <Link href={`/catalog/${r.id}`} className="font-semibold text-brand-ink hover:underline">{r.title}</Link> },
            { label: c.organizer, value: (r) => r.organizer_display_name ?? r.owner_email ?? "" },
            { label: c.starts, value: (r) => date(r.starts_at) },
            { label: c.status, value: (r) => label(t.status, r.status) },
            {
              label: c.suspended,
              value: (r) => (r.is_suspended ? t.common.yes : t.common.no),
              render: (r) => (r.is_suspended ? <Badge tone="danger">{t.event.suspendedBadge}</Badge> : t.common.no),
            },
            {
              label: c.paidSales,
              value: (r) => (!r.paid_sales_activated ? t.admin.salesOff : r.paid_sales_suspended ? t.admin.salesStoppedShort : t.admin.salesOn),
            },
            { label: t.admin.reason, value: (r) => r.suspension_reason ?? "" },
          ],
          actions: eventActions,
        });
      case "orders":
        return define({
          key: name,
          title: t.admin.sections.orders,
          load: adminApi.orders,
          serverExport: "orders",
          rowKey: (r) => r.id,
          searchHint: t.admin.searchOrders,
          filters: [{ param: "status", label: c.status, options: options(t.order.status, orderStatuses) }],
          columns: [
            { label: t.order.number, value: (r) => String(r.order_number) },
            { label: c.event, value: (r) => r.event_title ?? "" },
            { label: c.buyer, value: (r) => r.buyer_email },
            { label: c.status, value: (r) => label(t.order.status, r.status), render: (r) => <Badge tone={orderTone(r.status)}>{label(t.order.status, r.status)}</Badge> },
            { label: t.checkout.discount, value: (r) => r.discount_amount, render: (r) => money(r.discount_amount, r.currency) },
            { label: t.checkout.fee, value: (r) => r.fee_amount, render: (r) => money(r.fee_amount, r.currency) },
            { label: t.order.total, value: (r) => r.total_amount, render: (r) => money(r.total_amount, r.currency) },
            { label: t.promo.enter, value: (r) => r.promo_code ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
          ],
        });
      case "payments":
        return define({
          key: name,
          title: t.admin.sections.payments,
          hint: t.admin.demoPayments,
          load: adminApi.payments,
          serverExport: "payments",
          rowKey: (r) => r.id,
          searchHint: t.admin.searchPayments,
          filters: [{ param: "status", label: c.status, options: options(t.history.paymentStatus, paymentStatuses) }],
          columns: [
            { label: c.id, value: (r) => r.id },
            { label: t.order.number, value: (r) => String(r.order_number ?? "") },
            { label: c.amount, value: (r) => r.amount, render: (r) => money(r.amount, r.currency) },
            { label: c.status, value: (r) => label(t.history.paymentStatus, r.status) },
            { label: c.demo, value: (r) => (r.is_simulated ? t.common.yes : t.common.no) },
            { label: c.failure, value: (r) => r.failure_code ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
          ],
          actions: paymentActions,
        });
      case "activations":
        return define({
          key: name,
          title: t.admin.sections.activations,
          hint: t.admin.demoPayments,
          load: adminApi.activations,
          rowKey: (r) => r.event_id,
          filters: [{ param: "status", label: c.status, options: options(t.admin.activationStatus, ["NOT_ACTIVATED", "ACTIVE", "SUSPENDED"]) }],
          columns: [
            { label: c.event, value: (r) => r.event_title ?? "" },
            { label: c.organizer, value: (r) => r.organizer_display_name ?? "" },
            { label: c.status, value: (r) => label(t.admin.activationStatus, r.status) },
            { label: t.profile.verificationStatus, value: (r) => (r.organizer_verification_status ? label(t.verification, r.organizer_verification_status) : "") },
            { label: c.fee, value: (r) => r.activation_fee_amount, render: (r) => money(r.activation_fee_amount, "KZT") },
            { label: c.feePaid, value: (r) => date(r.activation_fee_paid_at) },
            { label: c.terms, value: (r) => date(r.terms_accepted_at) },
            { label: c.activated, value: (r) => date(r.activated_at) },
            { label: t.admin.reason, value: (r) => r.sales_suspension_reason ?? "" },
          ],
        });
      case "payouts":
        return define({
          key: name,
          title: t.admin.sections.payouts,
          hint: t.admin.payoutsHint,
          load: adminApi.payoutAccounts,
          rowKey: (r) => r.id,
          searchHint: t.admin.searchPayouts,
          filters: [{ param: "status", label: c.status, options: options(t.payoutStatus, ["PENDING", "ACTIVE", "BLOCKED"]) }],
          columns: [
            { label: c.organizer, value: (r) => r.organizer.name },
            { label: c.email, value: (r) => r.organizer_email ?? "" },
            { label: t.profile.verificationStatus, value: (r) => label(t.verification, r.organizer_verification_status) },
            { label: t.profile.provider, value: (r) => r.provider },
            { label: c.account, value: (r) => r.external_account_ref },
            { label: c.isDefault, value: (r) => (r.is_default ? t.common.yes : t.common.no) },
            {
              label: c.status,
              value: (r) => label(t.payoutStatus, r.status),
              render: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : r.status === "BLOCKED" ? "danger" : "warning"}>{label(t.payoutStatus, r.status)}</Badge>,
            },
            { label: c.updated, value: (r) => date(r.updated_at) },
          ],
          actions: payoutActions,
        });
      case "refunds":
        return define({
          key: name,
          title: t.admin.sections.refunds,
          hint: t.admin.demoPayments,
          load: adminApi.refunds,
          rowKey: (r) => r.id,
          filters: [
            { param: "status", label: c.status, options: options(t.refunds.status, ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"]) },
            { param: "kind", label: c.kind, options: options(t.admin.refundKind, ["CUSTOMER_REQUEST", "ORGANIZER_REQUEST", "EVENT_CANCELLATION"]) },
          ],
          columns: [
            { label: t.order.number, value: (r) => String(r.order_number ?? "") },
            { label: c.event, value: (r) => r.event?.title ?? "" },
            { label: c.amount, value: (r) => r.amount, render: (r) => money(r.amount, r.currency) },
            { label: c.status, value: (r) => label(t.refunds.status, r.status) },
            { label: c.kind, value: (r) => label(t.admin.refundKind, r.kind) },
            { label: t.admin.reason, value: (r) => r.reason ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
            { label: c.completed, value: (r) => date(r.completed_at) },
          ],
        });
      case "disputes":
        return define({
          key: name,
          title: t.admin.sections.disputes,
          hint: t.admin.disputeHint,
          load: adminApi.disputes,
          rowKey: (r) => r.id,
          filters: [{ param: "status", label: c.status, options: options(t.admin.disputeStatus, ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"]) }],
          columns: [
            { label: c.id, value: (r) => r.id, render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
            { label: c.payment, value: (r) => r.payment_id },
            { label: c.amount, value: (r) => r.amount, render: (r) => money(r.amount, r.currency) },
            { label: t.admin.reason, value: (r) => r.reason },
            { label: c.status, value: (r) => label(t.admin.disputeStatus, r.status) },
            { label: c.note, value: (r) => r.resolution_note ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
            { label: c.resolved, value: (r) => date(r.resolved_at) },
          ],
          actions: disputeActions,
        });
      case "reports":
        return define({
          key: name,
          title: t.admin.sections.reports,
          hint: t.admin.reportsHint,
          load: adminApi.reports,
          rowKey: (r) => r.id,
          filters: [
            { param: "status", label: c.status, options: options(t.reports.status, ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]) },
            { param: "reason", label: t.admin.reason, options: options(t.reports.reasons, [...REPORT_REASONS]) },
          ],
          columns: [
            {
              label: c.event,
              value: (r) => r.event.title,
              render: (r) => (
                <span className="flex flex-col items-start gap-1.5">
                  <Link href={`/catalog/${r.event.id}`} className="font-semibold text-brand-ink hover:underline">{r.event.title}</Link>
                  {r.event_is_suspended && <Badge tone="danger">{t.event.suspendedBadge}</Badge>}
                </span>
              ),
            },
            { label: t.admin.reason, value: (r) => label(t.reports.reasons, r.reason) },
            { label: t.reports.details, value: (r) => r.details ?? "" },
            { label: c.reporter, value: (r) => r.reporter_email ?? r.reporter?.name ?? "" },
            { label: c.openReports, value: (r) => String(r.event_active_reports) },
            { label: c.status, value: (r) => label(t.reports.status, r.status), render: (r) => <Badge tone={reportTone(r.status)}>{label(t.reports.status, r.status)}</Badge> },
            { label: c.note, value: (r) => r.resolution_note ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
          ],
          actions: reportActions,
        });
      case "failures":
        return define({
          key: name,
          title: t.admin.sections.failures,
          load: adminApi.failures,
          rowKey: (r) => `${r.kind}-${r.id}`,
          filters: [{ param: "kind", label: c.kind, options: options(t.admin.failureKind, ["PAYMENT", "REFUND", "NOTIFICATION"]) }],
          columns: [
            { label: c.kind, value: (r) => label(t.admin.failureKind, r.kind) },
            { label: c.code, value: (r) => r.code ?? "" },
            { label: c.message, value: (r) => r.message ?? "" },
            { label: c.attempts, value: (r) => String(r.attempts ?? "") },
            { label: c.orderId, value: (r) => r.order_id ?? "" },
            { label: c.created, value: (r) => date(r.occurred_at) },
          ],
        });
      case "support":
        return define({
          key: name,
          title: t.admin.sections.support,
          hint: t.admin.supportHint,
          load: adminApi.escalated,
          rowKey: (r) => r.id,
          filters: [{ param: "status", label: c.status, options: options(t.support.status, ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"]) }],
          columns: [
            { label: t.support.subject, value: (r) => r.subject, render: (r) => <Link href={`/support/${r.id}`} className="font-semibold text-brand-ink hover:underline">{r.subject}</Link> },
            { label: t.support.category, value: (r) => label(t.support.categories, r.category) },
            { label: c.event, value: (r) => r.event_title ?? "" },
            { label: t.support.requester, value: (r) => r.requester?.display_name ?? "" },
            { label: t.support.assignee, value: (r) => r.assignee?.display_name ?? "" },
            { label: c.status, value: (r) => label(t.support.status, r.status), render: (r) => <Badge tone={supportTone(r.status)}>{label(t.support.status, r.status)}</Badge> },
            { label: t.support.escalateReason, value: (r) => r.escalation_reason ?? "" },
          ],
        });
      case "actions":
        return define({
          key: name,
          title: t.admin.sections.actions,
          hint: t.admin.actionsHint,
          load: adminApi.actions,
          rowKey: (r) => r.id,
          columns: [
            { label: c.created, value: (r) => date(r.timestamp) },
            { label: c.admin, value: (r) => r.admin_display_name ?? "" },
            { label: c.action, value: (r) => label(t.history.actions, r.action.replaceAll(".", "_")) },
            { label: c.target, value: (r) => `${label(t.history.entities, r.entity_type)}${r.entity_id ? `: ${r.entity_id.slice(0, 8)}` : ""}` },
            { label: t.admin.reason, value: (r) => r.reason ?? "" },
          ],
        });
      case "campaigns":
        return (
          <>
            {define({
              key: name,
              title: t.admin.campaignsAll,
              load: adminApi.campaigns,
              rowKey: (r) => r.id,
              searchHint: t.admin.searchCampaigns,
              columns: [
                { label: t.campaigns.name, value: (r) => r.name },
                { label: t.campaigns.code, value: (r) => r.code ?? "" },
                { label: c.event, value: (r) => r.event?.title ?? "" },
                { label: t.checkout.discount, value: (r) => discountLabel(r.discount_type, r.discount_value, intlLocale) },
                { label: c.used, value: (r) => (r.redemption_limit === null ? String(r.redemption_count) : fmt(t.campaigns.ofLimit, { count: r.redemption_count, limit: r.redemption_limit })) },
                { label: c.status, value: (r) => label(t.campaigns.status, r.effective_status), render: (r) => <Badge tone={campaignTone(r.effective_status)}>{label(t.campaigns.status, r.effective_status)}</Badge> },
                { label: t.campaigns.startsAt, value: (r) => date(r.starts_at) },
                { label: t.campaigns.expiresAt, value: (r) => date(r.ends_at) },
              ],
            })}
            <AdminCampaigns />
          </>
        );
      case "settings":
        return <AdminSettings />;
    }
  }

  return (
    <>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {table()}
      {dialog && (
        <ReasonDialog
          title={dialog.title}
          consequence={dialog.consequence}
          confirmLabel={dialog.confirmLabel}
          danger={dialog.danger}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            setNotice({ tone: "success", text: await dialog.run(reason) });
            setDialog(null);
            // Keeps the search, filter and page the admin is on.
            dialog.reload();
          }}
        />
      )}
    </>
  );
}

/** Lets TypeScript infer the row type from `load` for each section. */
function define<T>(section: AdminSection<T>) {
  return <AdminTable section={section} />;
}
