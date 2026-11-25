"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Field, Input, PageLoader, Select } from "@/components/ui";
import { type SupportQuery, supportApi } from "@/lib/api/endpoints";
import type { Page, SupportCase } from "@/lib/api/types";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES, supportTone } from "@/lib/support";
import { useApi } from "@/lib/useApi";

const PAGE = 20;

export function CaseRow({ item }: { item: SupportCase }) {
  const { t, intlLocale } = useI18n();
  return (
    <Link href={`/support/${item.id}`} className="flex flex-col gap-2 py-4 hover:bg-[#fafafb] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-[17px] font-semibold">{item.subject}</span>
        <span className="text-sm text-muted">
          {[t.support.categories[item.category] ?? item.category, item.event_title, item.order_number && `#${item.order_number}`].filter(Boolean).join(" · ")}
        </span>
        <span className="text-[13px] text-muted">
          {item.requester?.display_name} · {formatDateTime(item.updated_at, DEFAULT_TIMEZONE, intlLocale)} · {fmt(t.support.messageCount, { count: item.message_count })}
          {item.assignee && ` · ${fmt(t.support.assignedTo, { name: item.assignee.display_name })}`}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {item.is_escalated && <Badge tone="danger">{t.support.escalated}</Badge>}
        <Badge tone={supportTone(item.status)}>{t.support.status[item.status] ?? item.status}</Badge>
      </div>
    </Link>
  );
}

type Props = { query: Pick<SupportQuery, "role" | "event_id">; empty: string };

/** The server returns (and counts) only conversations the caller may see. */
export function CaseList({ query, empty }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [pages, setPages] = useState(1);

  const key = JSON.stringify([query, status, category, q]);
  const { data, error, reload } = useApi<{ key: string; page: Page<SupportCase> }>(
    () =>
      supportApi
        .list({ ...query, status: status ? [status] : undefined, category: category || undefined, q: q || undefined, limit: Math.min(100, pages * PAGE), offset: 0 })
        .then((page) => ({ key, page })),
    [key, pages],
  );
  const page = data?.key === key ? data.page : null;
  const filtered = Boolean(status || category || q);
  const reset = () => setPages(1);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          reset();
          setQ(input.trim());
        }}
      >
        <Field label={t.support.search} className="flex-[1_1_200px]">
          {(props) => <Input {...props} type="search" value={input} onChange={(e) => setInput(e.target.value)} maxLength={100} />}
        </Field>
        <Field label={t.support.statusLabel} className="flex-[1_1_160px]">
          {(props) => (
            <Select {...props} value={status} onChange={(e) => { reset(); setStatus(e.target.value); }}>
              <option value="">{t.support.any}</option>
              {SUPPORT_STATUSES.map((s) => <option key={s} value={s}>{t.support.status[s]}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t.support.category} className="flex-[1_1_160px]">
          {(props) => (
            <Select {...props} value={category} onChange={(e) => { reset(); setCategory(e.target.value); }}>
              <option value="">{t.support.any}</option>
              {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{t.support.categories[c]}</option>)}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="secondary" className="h-12">{t.support.find}</Button>
      </form>

      {error ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
        </Alert>
      ) : !page ? (
        <PageLoader label={t.common.loading} />
      ) : page.items.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">{filtered ? t.support.noMatches : empty}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line-soft">
            {page.items.map((item) => <li key={item.id}><CaseRow item={item} /></li>)}
          </ul>
          {page.items.length < page.total && page.items.length < 100 && (
            <Button variant="secondary" onClick={() => setPages((n) => n + 1)}>
              {fmt(t.history.more, { shown: page.items.length, total: page.total })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
