"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { ticketsApi } from "@/lib/api/endpoints";
import type { Ticket } from "@/lib/api/types";
import { formatDateTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";
import { isTicketUsable, ticketPdfFilename, ticketTone } from "@/lib/tickets";

/** Renders the signed payload client-side; the API sends a string, not an image. */
function TicketQr({ payload, label }: { payload: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Level M + a 4-module quiet zone keeps it scannable from screens and paper.
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 4, width: 480 }).then(
      (url) => active && setSrc(url),
      () => active && setSrc(null),
    );
    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <div className="flex h-[200px] w-[200px] shrink-0 items-center justify-center rounded-xl border border-line bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize
        <img src={src} alt={label} width={200} height={200} className="h-[200px] w-[200px] rounded-xl" />
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Prints the server-generated PDF (the canonical print layout) through a
 * hidden iframe. Browsers that refuse to print a PDF frame get it in a new tab.
 */
function printBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const { t, intlLocale } = useI18n();
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const [error, setError] = useState<unknown>(null);

  const usable = isTicketUsable(ticket);
  const statusLabel = (t.ticket.status as Record<string, string>)[ticket.status] ?? ticket.status;
  const help = (t.ticket.statusHelp as Record<string, string>)[ticket.status];
  const place = [ticket.venue_name, ticket.city].filter(Boolean).join(", ");

  async function run(kind: "download" | "print") {
    setBusy(kind);
    setError(null);
    try {
      const blob = await ticketsApi.pdf(ticket.public_id);
      if (kind === "download") saveBlob(blob, ticketPdfFilename(ticket.public_id));
      else printBlob(blob);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      aria-label={`${ticket.ticket_type_name} · ${statusLabel}`}
      className="flex flex-col gap-5 rounded-[20px] border border-line-soft bg-surface p-5 sm:flex-row sm:p-6"
    >
      {usable && <TicketQr payload={ticket.qr_payload} label={fmt(t.ticket.qrAlt, { id: ticket.public_id })} />}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-lg font-semibold">{ticket.ticket_type_name}</span>
            <span className="text-sm text-muted">
              {formatDateTime(ticket.event_starts_at, ticket.timezone, intlLocale)}
              {place && ` · ${place}`}
            </span>
          </div>
          <Badge tone={ticketTone(ticket.status)}>{statusLabel}</Badge>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex flex-col">
            <dt className="text-[13px] text-muted">{t.ticket.attendee}</dt>
            <dd>{ticket.attendee_name || ticket.attendee_email}</dd>
          </div>
          {ticket.seat_label && (
            <div className="flex flex-col">
              <dt className="text-[13px] text-muted">{t.ticket.seat}</dt>
              <dd>{ticket.seat_label}</dd>
            </div>
          )}
          <div className="flex flex-col sm:col-span-2">
            <dt className="text-[13px] text-muted">{t.ticket.id}</dt>
            <dd className="break-all font-mono text-[13px]">{ticket.public_id}</dd>
          </div>
        </dl>

        {help && (
          <p className="text-sm text-ink-2">
            {fmt(help, { date: formatDateTime(ticket.checked_in_at ?? ticket.cancelled_at, ticket.timezone, intlLocale) })}
          </p>
        )}

        {usable && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="md" onClick={() => run("download")} loading={busy === "download"} disabled={busy !== null}>
              {t.ticket.download}
            </Button>
            <Button size="md" variant="secondary" onClick={() => run("print")} loading={busy === "print"} disabled={busy !== null}>
              {t.ticket.print}
            </Button>
          </div>
        )}

        {error !== null && <Alert tone="error">{errorMessage(error, t)}</Alert>}
      </div>
    </article>
  );
}
