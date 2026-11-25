"use client";

import Link from "next/link";
import { Alert } from "@/components/ui";
import type { Event, TicketType } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { hasPaidTickets, isEventOver } from "@/lib/paidSales";

/** Tells the organizer that buyers cannot pay yet; nothing when that is not the case. */
export function PaidSalesNotice({ event, ticketTypes }: { event: Event; ticketTypes: TicketType[] }) {
  const { t } = useI18n();
  if (event.paid_sales_active || event.is_suspended || isEventOver(event.status) || !hasPaidTickets(ticketTypes)) return null;
  return (
    <Alert tone="warning">
      {t.paidSales.notice}{" "}
      <Link href={`/events/${event.id}/paid-sales`} className="font-semibold underline">
        {t.paidSales.noticeLink}
      </Link>
    </Alert>
  );
}
