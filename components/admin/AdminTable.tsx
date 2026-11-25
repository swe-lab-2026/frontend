"use client";

import { useState } from "react";
import { Alert, Button, Card, CardHeader, Field, Input, PageLoader, Select } from "@/components/ui";
import { adminApi, type AdminExportKind, type AdminQuery } from "@/lib/api/endpoints";
import type { Page } from "@/lib/api/types";
import { EXPORT_MAX, loadAll, readExport } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { saveBlob } from "@/lib/download";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { useApi } from "@/lib/useApi";

export type Column<T> = {
  label: string;
  /** Plain text: shown unless `render` is given, and always used for export. */
  value: (row: T) => string;
  render?: (row: T) => React.ReactNode;
};

export type AdminSection<T> = {
  key: string;
  title: string;
  hint?: string;
  load: (query: AdminQuery) => Promise<Page<T>>;
  rowKey: (row: T) => string | number;
  columns: Column<T>[];
  searchHint?: string;
  filters?: { param: string; label: string; options: { value: string; label: string }[] }[];
  /** Exported by the server (and logged there); other lists are exported from the rows shown. */
  serverExport?: AdminExportKind;
  actions?: (row: T, reload: () => void) => React.ReactNode;
};

const PAGE = 20;

export function AdminTable<T>({ section }: { section: AdminSection<T> }) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Record<string, string | undefined>>({});
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "warning"; text: string } | null>(null);

  const query = { q: q || undefined, ...chosen };
  const key = JSON.stringify([section.key, query, offset]);
  const { data, error, reload } = useApi<{ key: string; page: Page<T> }>(
    () => section.load({ ...query, limit: PAGE, offset }).then((page) => ({ key, page })),
    [key],
  );
  const page = data?.key === key ? data.page : null;

  async function exportCsv() {
    setExporting(true);
    setNotice(null);
    try {
      if (section.serverExport) {
        // Only `q` and `status` exist on these lists, so the file matches the screen.
        const file = await readExport(await adminApi.exportCsv(section.serverExport, query));
        saveBlob(file.blob, `biletflow-${section.key}.csv`);
        if (file.truncated) setNotice({ tone: "warning", text: fmt(t.admin.exportTruncated, { count: file.rows }) });
        return;
      }
      const { rows, truncated } = await loadAll((limit, from) => section.load({ ...query, limit, offset: from }));
      const csv = toCsv(section.columns.map((c) => c.label), rows.map((row) => section.columns.map((c) => c.value(row))));
      saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `biletflow-${section.key}.csv`);
      if (truncated) setNotice({ tone: "warning", text: fmt(t.admin.exportTruncated, { count: EXPORT_MAX }) });
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err, t) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card aria-labelledby="admin-h">
      <title>{`${section.title} · ${t.admin.title} — BiletFlow`}</title>
      <CardHeader
        id="admin-h"
        title={section.title}
        description={section.hint}
        action={
          <Button variant="secondary" loading={exporting} disabled={!page || page.total === 0} onClick={exportCsv}>{t.admin.exportCsv}</Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        {section.searchHint && (
          <form
            className="flex min-w-0 flex-[1_1_280px] items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setOffset(0);
              setQ(input.trim());
            }}
          >
            <Field label={t.support.search} className="flex-1">
              {(props) => <Input {...props} type="search" placeholder={section.searchHint} value={input} onChange={(e) => setInput(e.target.value)} maxLength={200} />}
            </Field>
            <Button type="submit" variant="secondary" className="h-12">{t.support.find}</Button>
          </form>
        )}
        {section.filters?.map(({ param, label, options }) => (
          <Field key={param} label={label} className="flex-[1_1_180px] sm:max-w-[240px]">
            {(props) => (
              <Select
                {...props}
                value={chosen[param] ?? ""}
                onChange={(e) => {
                  setOffset(0);
                  setChosen({ ...chosen, [param]: e.target.value || undefined });
                }}
              >
                <option value="">{t.support.any}</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            )}
          </Field>
        ))}
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {error ? (
        <Alert tone="error">
          {errorMessage(error, t)}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">{t.common.retry}</button>
        </Alert>
      ) : !page ? (
        <PageLoader label={t.common.loading} />
      ) : page.items.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted">{t.admin.empty}</p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-xl border border-line-soft">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#f7f8f9] text-left text-muted">
                  {section.columns.map((c) => <th key={c.label} scope="col" className="px-3 py-3 font-semibold">{c.label}</th>)}
                  {/* Stays in view when the table is wider than the screen. */}
                  {section.actions && <th scope="col" className="sm:sticky sm:right-0 bg-[#f7f8f9] px-3 py-3"><span className="sr-only">{t.common.actions}</span></th>}
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <tr key={section.rowKey(row)} className="border-t border-line-soft align-top">
                    {section.columns.map((c) => (
                      <td key={c.label} className="max-w-[260px] break-words px-3 py-3">{c.render ? c.render(row) : c.value(row) || "—"}</td>
                    ))}
                    {section.actions && <td className="sm:sticky sm:right-0 min-w-[150px] bg-surface px-3 py-2 text-right">{section.actions(row, reload)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span>{fmt(t.admin.range, { from: offset + 1, to: offset + page.items.length, total: page.total })}</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{t.admin.prev}</Button>
              <Button variant="secondary" disabled={offset + page.items.length >= page.total} onClick={() => setOffset(offset + PAGE)}>{t.admin.next}</Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
