"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, CardHeader, Field, Input, PageLoader, Select } from "@/components/ui";
import { campaignsApi, eventsApi, ticketTypesApi } from "@/lib/api/endpoints";
import type { AuditEntry, TimelineEntry } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { changedFields, type DayRange, isBadRange, rangeQuery, scalarChanges, statusChange, TIMELINE_FILTERS, type TimelineFilter, updatedFields } from "@/lib/history";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";
import { useEventContext } from "../EventContext";

const PAGE = 50;
type Filter = DayRange & { type: TimelineFilter | "all" };
const NO_FILTER: Filter = { from: "", to: "", type: "all" };

type Names = { things: Map<string, string>; changes: Map<number, AuditEntry> };

/**
 * Names for the ids in the log, and old/new values of ticket type changes (the
 * timeline itself is redacted). Optional: entries still read well without them.
 */
async function loadNames(eventId: string): Promise<Names> {
  const [attendees, types, campaigns, changes] = await Promise.all([
    eventsApi.attendees(eventId).catch(() => []),
    ticketTypesApi.list(eventId).catch(() => []),
    campaignsApi.list(eventId).catch(() => []),
    eventsApi.auditLog(eventId, "ticket_type.updated").catch(() => []),
  ]);
  const things = new Map<string, string>();
  for (const a of attendees) things.set(a.order_id, `#${a.order_number}`);
  for (const tt of types) things.set(tt.id, tt.name);
  for (const c of campaigns) things.set(c.id, c.name);
  return { things, changes: new Map(changes.map((entry) => [entry.id, entry])) };
}

export default function HistoryPage() {
  const { t, intlLocale } = useI18n();
  const { user } = useAuth();
  const { event, version } = useEventContext();
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [limit, setLimit] = useState(PAGE);
  const [refresh, setRefresh] = useState(0);

  const badRange = isBadRange(filter);
  const filterKey = `${filter.from}|${filter.to}|${filter.type}`;
  const { data, error, reload } = useApi<{ key: string; items: TimelineEntry[]; total: number } | null>(
    async () => {
      if (badRange) return null;
      const items: TimelineEntry[] = [];
      let total = 0;
      // The API caps a page at 200; "show more" re-reads from the top so that
      // entries added meanwhile neither repeat nor push others out.
      while (items.length < limit) {
        const page = await eventsApi.timeline(event.id, {
          ...rangeQuery(filter, event.timezone),
          action: filter.type === "all" ? undefined : [...TIMELINE_FILTERS[filter.type]],
          limit: Math.min(200, limit - items.length),
          offset: items.length,
        });
        items.push(...page.items);
        total = page.total;
        if (page.items.length === 0 || items.length >= total) break;
      }
      return { key: filterKey, items, total };
    },
    [event.id, version, filterKey, limit, refresh],
  );
  const { data: names } = useApi<Names>(() => loadNames(event.id), [event.id, version, refresh]);

  if (error && !data) {
    return (
      <Alert tone="error">
        {errorMessage(error, t)}{" "}
        <button type="button" onClick={reload} className="font-semibold underline">
          {t.common.retry}
        </button>
      </Alert>
    );
  }
  if (data === undefined) return <PageLoader label={t.common.loading} />;

  function change(patch: Partial<Filter>) {
    setLimit(PAGE);
    setFilter((prev) => ({ ...prev, ...patch }));
  }

  const filtered = filter.from !== "" || filter.to !== "" || filter.type !== "all";
  const current = !badRange && data?.key === filterKey ? data : null;

  const actor = (entry: TimelineEntry) => {
    const role = (t.history.actors as Record<string, string>)[entry.actor.type] ?? entry.actor.type;
    if (entry.actor.user_id && entry.actor.user_id === user?.user_id) return t.history.you;
    return entry.actor.display_name ? `${entry.actor.display_name} (${role})` : role;
  };

  const entity = (entry: TimelineEntry) => {
    const type = (t.history.entities as Record<string, string>)[entry.entity_type] ?? entry.entity_type;
    if (!entry.entity_id) return type;
    const name = entry.entity_id === event.id ? event.title : names?.things.get(entry.entity_id);
    return `${type}: ${name ?? entry.entity_id.slice(0, 8)}`;
  };

  const details = (entry: TimelineEntry): string | null => {
    const status = statusChange(entry);
    if (status) {
      const labels = (entry.entity_type === "support_case" ? t.support.status : t.history.paymentStatus) as Record<string, string>;
      return status.map((value) => labels[value] ?? value).join(" → ");
    }
    const fieldName = (key: string) => (t.history.fields as Record<string, string>)[key] ?? key;
    const audit = names?.changes.get(entry.id);
    const parts = audit
      ? changedFields(audit)
          .filter((key) => key in t.history.fields)
          .map((key) => {
            const [value] = scalarChanges(audit, [key]);
            return value && ["price", "capacity"].includes(key) ? `${fieldName(key)}: ${value}` : fieldName(key);
          })
      : updatedFields(entry).map(fieldName);
    return parts.length > 0 ? fmt(t.history.changed, { fields: parts.join(", ") }) : null;
  };

  return (
    <Card aria-labelledby="history-h">
      <title>{`${t.history.tab} · ${event.title} — BiletFlow`}</title>
      <CardHeader
        id="history-h"
        title={t.history.title}
        description={t.history.hint}
        action={<Button variant="secondary" onClick={() => setRefresh((n) => n + 1)}>{t.inventory.refresh}</Button>}
      />
      {Boolean(error) && <Alert tone="error">{errorMessage(error, t)}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <Field label={t.history.from} className="flex-[1_1_160px] sm:max-w-[200px]">
          {(props) => <Input {...props} type="date" value={filter.from} onChange={(e) => change({ from: e.target.value })} />}
        </Field>
        <Field label={t.history.to} error={badRange ? t.history.badRange : undefined} className="flex-[1_1_160px] sm:max-w-[200px]">
          {(props) => <Input {...props} type="date" value={filter.to} onChange={(e) => change({ to: e.target.value })} />}
        </Field>
        <Field label={t.history.type} className="flex-[1_1_180px] sm:max-w-[240px]">
          {(props) => (
            <Select {...props} value={filter.type} onChange={(e) => change({ type: e.target.value as Filter["type"] })}>
              <option value="all">{t.history.allTypes}</option>
              {(Object.keys(TIMELINE_FILTERS) as TimelineFilter[]).map((key) => (
                <option key={key} value={key}>{t.history.categories[key]}</option>
              ))}
            </Select>
          )}
        </Field>
        {filtered && (
          <Button variant="ghost" className="h-12" onClick={() => change(NO_FILTER)}>{t.history.reset}</Button>
        )}
      </div>

      {badRange ? null : !current ? (
        error ? null : <PageLoader label={t.common.loading} />
      ) : current.items.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">{filtered ? t.history.noMatches : t.history.empty}</p>
      ) : (
        <>
          <ol className="flex flex-col">
            {current.items.map((entry) => {
              const extra = details(entry);
              return (
                <li key={entry.id} className="flex flex-col gap-1 border-l-2 border-line py-3 pl-5 sm:flex-row sm:gap-6">
                  <time dateTime={entry.timestamp} className="w-[180px] shrink-0 text-[13px] leading-6 text-muted">
                    {formatDateTime(entry.timestamp, event.timezone, intlLocale)}
                  </time>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">
                      {(t.history.actions as Record<string, string>)[entry.action.replaceAll(".", "_")] ?? entry.description}
                    </span>
                    <span className="break-words text-sm text-ink-2">
                      {actor(entry)} ·{" "}
                      {entry.entity_type === "support_case" && entry.entity_id ? (
                        <Link href={`/support/${entry.entity_id}`} className="font-semibold text-brand-ink hover:underline">{entity(entry)}</Link>
                      ) : (
                        entity(entry)
                      )}
                    </span>
                    {extra && <span className="text-[13px] text-muted">{extra}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
          {current.items.length < current.total && (
            <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
              {fmt(t.history.more, { shown: current.items.length, total: current.total })}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
