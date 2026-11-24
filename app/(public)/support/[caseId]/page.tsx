"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import { RequireAuth } from "@/components/support/RequireAuth";
import { Alert, BackLink, Badge, Button, Card, Field, PageLoader, Select, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { supportApi, ticketsApi } from "@/lib/api/endpoints";
import type { SupportAssignable, SupportCase, SupportMessage, SupportStatus, Ticket } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { allowedStatuses, MESSAGE_MAX, mergeMessages, pollCursor, supportTone } from "@/lib/support";
import { useApi } from "@/lib/useApi";
import { usePolling } from "@/lib/usePolling";

// SRS 4.13: light polling, no WebSockets.
const POLL_MS = 5000;

function Thread({ caseId }: { caseId: string }) {
  const { t, intlLocale } = useI18n();
  const { user } = useAuth();
  const [item, setItem] = useState<SupportCase | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const cursor = useRef(0);

  const receive = useCallback((incoming: SupportMessage[]) => {
    setMessages((prev) => {
      const next = mergeMessages(prev, incoming);
      cursor.current = pollCursor(next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      let after = cursor.current;
      const collected: SupportMessage[] = [];
      for (;;) {
        const page = await supportApi.messages(caseId, after);
        collected.push(...page.items);
        if (!page.has_more || page.items.length === 0) break;
        after = page.items[page.items.length - 1].sequence;
      }
      const fresh = await supportApi.get(caseId);
      receive(collected);
      setItem(fresh);
      setError(null);
    } catch (err) {
      setError(err);
      // Access revoked or case gone: stop showing the conversation.
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        setItem(null);
        setMessages([]);
        cursor.current = 0;
      }
    }
  }, [caseId, receive]);

  usePolling(refresh, POLL_MS);

  if (!item) {
    if (!error) return <PageLoader label={t.common.loading} />;
    return (
      <Alert tone="error">
        {errorMessage(error, t)}{" "}
        <button type="button" onClick={refresh} className="font-semibold underline">{t.common.retry}</button>
      </Alert>
    );
  }

  async function act(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    setActionError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (err) {
      setActionError(err);
      // The case may have moved on (e.g. resolved by someone else).
      await refresh();
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (await act("send", async () => receive([await supportApi.send(caseId, body)]))) setDraft("");
  }

  const canManage = item.access?.can_manage ?? false;
  const resolved = item.status === "RESOLVED";

  return (
    <>
      <title>{`${item.subject} — BiletFlow`}</title>
      <Card aria-labelledby="case-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 id="case-h" className="min-w-0 break-words text-2xl font-bold tracking-tight">{item.subject}</h1>
          <div className="flex flex-wrap gap-2">
            {item.is_escalated && <Badge tone="danger">{t.support.escalated}</Badge>}
            <Badge tone={supportTone(item.status)}>{t.support.status[item.status] ?? item.status}</Badge>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t.support.category}</dt>
          <dd>{t.support.categories[item.category] ?? item.category}</dd>
          {item.event_title && (
            <>
              <dt className="text-muted">{t.order.event}</dt>
              <dd>{item.event_id ? <Link href={`/catalog/${item.event_id}`} className="font-semibold text-brand-ink hover:underline">{item.event_title}</Link> : item.event_title}</dd>
            </>
          )}
          {item.order_number && (
            <>
              <dt className="text-muted">{t.order.number}</dt>
              <dd className="font-mono">
                {item.order_id && item.access?.relation === "REQUESTER" ? (
                  <Link href={`/orders/${item.order_id}`} className="font-semibold text-brand-ink hover:underline">#{item.order_number}</Link>
                ) : (
                  `#${item.order_number}`
                )}
              </dd>
            </>
          )}
          {item.ticket_id && (
            <>
              <dt className="text-muted">{t.support.ticket}</dt>
              <dd><TicketLabel item={item} /></dd>
            </>
          )}
          <dt className="text-muted">{t.support.requester}</dt>
          <dd>{item.requester?.display_name ?? "—"}</dd>
          <dt className="text-muted">{t.support.assignee}</dt>
          <dd>{item.assignee?.display_name ?? t.support.unassigned}</dd>
          {item.escalation_reason && (
            <>
              <dt className="text-muted">{t.support.escalated}</dt>
              <dd className="break-words">{item.escalation_reason}</dd>
            </>
          )}
        </dl>
        <CaseActions item={item} canManage={canManage} busy={busy} act={act} />
        {actionError !== null && <Alert tone="error">{errorMessage(actionError, t)}</Alert>}
      </Card>

      {Boolean(error) && <Alert tone="warning">{errorMessage(error, t)}</Alert>}

      <Card aria-labelledby="thread-h">
        <h2 id="thread-h" className="text-lg font-bold">{t.support.thread}</h2>
        <ol aria-live="polite" className="flex flex-col gap-3">
          {messages.map((message) => {
            const own = message.sender.user_id === user?.user_id;
            const role = message.sender.role ? t.support.roles[message.sender.role] : undefined;
            return (
              <li key={message.sequence} className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-3 ${own ? "self-end bg-brand-soft" : "self-start bg-canvas"}`}>
                <span className="text-[13px] text-muted">
                  <span className="font-semibold text-ink-2">{own ? t.history.you : (message.sender.display_name ?? "—")}</span>
                  {role && ` · ${role}`} · {formatDateTime(message.created_at, DEFAULT_TIMEZONE, intlLocale)}
                </span>
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.body}</p>
              </li>
            );
          })}
        </ol>
        {resolved ? (
          <Alert tone="info">{t.support.resolvedNote}</Alert>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3 border-t border-line-soft pt-4">
            <Field label={t.support.reply}>
              {(props) => <Textarea {...props} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MESSAGE_MAX} />}
            </Field>
            <Button type="submit" className="self-end" loading={busy === "send"} disabled={!draft.trim() || busy !== null}>{t.support.send}</Button>
          </form>
        )}
      </Card>
    </>
  );
}

/**
 * A case carries the internal ticket id. The buyer knows the printed one, which
 * their own ticket list can supply; staff see a short reference.
 */
function TicketLabel({ item }: { item: SupportCase }) {
  const own = item.access?.relation === "REQUESTER";
  const { data } = useApi<Ticket | null>(
    async () => (own ? ((await ticketsApi.list().catch(() => [])).find((ticket) => ticket.ticket_id === item.ticket_id) ?? null) : null),
    [own, item.ticket_id],
  );
  return (
    <span className="break-all">
      {data && `${data.ticket_type_name} · `}
      <span className="font-mono text-[13px]">{data?.public_id ?? item.ticket_id?.slice(0, 8)}</span>
    </span>
  );
}

type Act = (name: string, action: () => Promise<unknown>) => Promise<boolean>;

function CaseActions({ item, canManage, busy, act }: { item: SupportCase; canManage: boolean; busy: string | null; act: Act }) {
  const { t } = useI18n();
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState("");
  const { data: people } = useApi<SupportAssignable[]>(
    () => (canManage ? supportApi.assignable(item.id).catch(() => []) : Promise.resolve([])),
    [item.id, canManage, item.is_escalated],
  );

  const targets = allowedStatuses(item.status, canManage);
  const label = (status: SupportStatus) =>
    status === "RESOLVED" ? t.support.markResolved : item.status === "RESOLVED" && status === "OPEN" ? t.support.reopen : t.support.status[status];
  // Keep the current assignee selectable even if no longer eligible.
  const options = [...(people ?? [])];
  if (item.assignee && !options.some((p) => p.user_id === item.assignee?.user_id)) options.unshift({ ...item.assignee, role: "STAFF" });

  return (
    <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
      <div className="flex flex-wrap items-end gap-3">
        {canManage && (
          <Field label={t.support.assignee} className="min-w-[220px]">
            {(props) => (
              <Select
                {...props}
                className={`${props.className} h-11`}
                value={item.assignee?.user_id ?? ""}
                disabled={busy !== null}
                onChange={(e) => act("assign", () => supportApi.assign(item.id, e.target.value || null))}
              >
                <option value="">{t.support.unassigned}</option>
                {options.map((p) => <option key={p.user_id} value={p.user_id}>{`${p.display_name} (${t.support.roles[p.role]})`}</option>)}
              </Select>
            )}
          </Field>
        )}
        {targets.map((status) => (
          <Button key={status} variant="secondary" loading={busy === status} disabled={busy !== null} onClick={() => act(status, () => supportApi.setStatus(item.id, status))}>
            {label(status)}
          </Button>
        ))}
        {item.access?.can_escalate && !escalating && (
          <Button variant="ghost" disabled={busy !== null} onClick={() => setEscalating(true)}>{t.support.escalate}</Button>
        )}
      </div>
      {escalating && item.access?.can_escalate && (
        <form
          className="flex flex-col gap-3 rounded-xl bg-canvas p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("escalate", () => supportApi.escalate(item.id, reason.trim()))) setEscalating(false);
          }}
        >
          <Field label={t.support.escalateReason} hint={t.support.escalateHint}>
            {(props) => <Textarea {...props} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEscalating(false)}>{t.common.cancel}</Button>
            <Button type="submit" loading={busy === "escalate"} disabled={reason.trim().length < 3 || busy !== null}>{t.support.escalate}</Button>
          </div>
        </form>
      )}
      {canManage && <p className="text-[13px] text-muted">{fmt(t.support.yourRole, { role: t.support.roles[item.access?.relation ?? "STAFF"] })}</p>}
    </div>
  );
}

export default function SupportCasePage() {
  const { t } = useI18n();
  const { caseId } = useParams<{ caseId: string }>();
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      <BackLink href="/support">{t.support.title}</BackLink>
      <Suspense>
        <RequireAuth>
          <Thread key={caseId} caseId={caseId} />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
