"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { AdminCampaigns } from "@/components/admin/AdminCampaigns";
import { type AdminSection, AdminTable } from "@/components/admin/AdminTable";
import { ReasonDialog } from "@/components/admin/ReasonDialog";
import { Alert, Badge, Button } from "@/components/ui";
import { adminApi } from "@/lib/api/endpoints";
import type { AdminEvent, AdminUser } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { formatMoney } from "@/lib/registration";
import { supportTone } from "@/lib/support";
import { orderTone } from "@/lib/tickets";
import { ADMIN_SECTIONS, type AdminSectionKey } from "../sections";

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
  const [notice, setNotice] = useState<string | null>(null);

  const date = (iso: string | null) => (iso ? formatDateTime(iso, DEFAULT_TIMEZONE, intlLocale) : "");
  const money = (amount: string, currency: string) => formatMoney(amount, currency, intlLocale);
  const label = (map: object, value: string) => (map as Record<string, string>)[value] ?? value;
  const options = (map: object, values: string[]) => values.map((value) => ({ value, label: label(map, value) }));
  const c = t.admin.columns;

  const userActions = (row: AdminUser, reload: () => void) => {
    if (row.user_id === me?.user_id || row.global_role === "PLATFORM_ADMIN" || row.status === "DELETED") return null;
    const suspended = row.status === "BLOCKED";
    return (
      <Button
        variant={suspended ? "secondary" : "danger-outline"}
        className="h-10 px-3 text-sm"
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

  const eventActions = (row: AdminEvent, reload: () => void) => (
    <div className="flex flex-col items-end gap-1.5">
      {(row.is_suspended || (row.status !== "CANCELLED" && row.status !== "COMPLETED")) && (
        <Button
          variant={row.is_suspended ? "secondary" : "danger-outline"}
          className="h-10 px-3 text-sm"
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
          className="h-10 px-3 text-sm"
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
          rowKey: (r) => r.user_id,
          searchHint: t.admin.searchUsers,
          filter: { param: "status", label: c.status, options: options(t.admin.userStatus, ["ACTIVE", "BLOCKED", "DELETED"]) },
          columns: [
            { label: c.email, value: (r) => r.email },
            { label: c.name, value: (r) => `${r.first_name} ${r.last_name}`.trim() },
            { label: c.role, value: (r) => label(t.admin.roles, r.global_role) },
            { label: c.organizer, value: (r) => r.organizer_display_name ?? "" },
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
          rowKey: (r) => r.id,
          searchHint: t.admin.searchEvents,
          filter: { param: "status", label: c.status, options: options(t.status, ["DRAFT", "PUBLISHED", "UNPUBLISHED", "CANCELLED", "COMPLETED"]) },
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
          rowKey: (r) => r.id,
          searchHint: t.admin.searchOrders,
          filter: { param: "status", label: c.status, options: options(t.order.status, orderStatuses) },
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
          rowKey: (r) => r.id,
          searchHint: t.admin.searchPayments,
          filter: { param: "status", label: c.status, options: options(t.history.paymentStatus, paymentStatuses) },
          columns: [
            { label: c.id, value: (r) => r.id },
            { label: t.order.number, value: (r) => String(r.order_number ?? "") },
            { label: c.amount, value: (r) => r.amount, render: (r) => money(r.amount, r.currency) },
            { label: c.status, value: (r) => label(t.history.paymentStatus, r.status) },
            { label: c.demo, value: (r) => (r.is_simulated ? t.common.yes : t.common.no) },
            { label: c.failure, value: (r) => r.failure_code ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
          ],
        });
      case "activations":
        return define({
          key: name,
          title: t.admin.sections.activations,
          hint: t.admin.demoPayments,
          load: adminApi.activations,
          rowKey: (r) => r.event_id,
          filter: { param: "status", label: c.status, options: options(t.admin.activationStatus, ["NOT_ACTIVATED", "ACTIVE", "SUSPENDED"]) },
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
      case "refunds":
        return define({
          key: name,
          title: t.admin.sections.refunds,
          hint: t.admin.demoPayments,
          load: adminApi.refunds,
          rowKey: (r) => r.id,
          filter: { param: "kind", label: c.kind, options: options(t.admin.refundKind, ["CUSTOMER_REQUEST", "EVENT_CANCELLATION"]) },
          columns: [
            { label: t.order.number, value: (r) => String(r.order_number ?? "") },
            { label: c.amount, value: (r) => r.amount, render: (r) => money(r.amount, r.currency) },
            { label: c.status, value: (r) => label(t.history.paymentStatus, r.status) },
            { label: c.kind, value: (r) => label(t.admin.refundKind, r.kind) },
            { label: t.admin.reason, value: (r) => r.reason ?? "" },
            { label: c.created, value: (r) => date(r.created_at) },
          ],
        });
      case "failures":
        return define({
          key: name,
          title: t.admin.sections.failures,
          load: adminApi.failures,
          rowKey: (r) => `${r.kind}-${r.id}`,
          filter: { param: "kind", label: c.kind, options: options(t.admin.failureKind, ["PAYMENT", "REFUND", "NOTIFICATION"]) },
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
          filter: { param: "status", label: c.status, options: options(t.support.status, ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"]) },
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
        return <AdminCampaigns />;
    }
  }

  return (
    <>
      {notice && <Alert tone="success">{notice}</Alert>}
      {table()}
      {dialog && (
        <ReasonDialog
          title={dialog.title}
          consequence={dialog.consequence}
          confirmLabel={dialog.confirmLabel}
          danger={dialog.danger}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            setNotice(await dialog.run(reason));
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
