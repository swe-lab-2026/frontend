"use client";

import { useEffect, useState } from "react";
import { campaignsApi } from "@/lib/api/endpoints";
import type { OrderItemRequest, PromoQuote } from "@/lib/api/types";
import type { Promo } from "@/lib/registration";

type Settled = { key: string; quote: PromoQuote | null; error: unknown };

/**
 * Server-calculated totals for a selection with a promotion. The client never
 * works out a discount itself: while the server has not answered for exactly
 * this selection, there is no quote to show.
 */
export function usePromoQuote(eventId: string, items: OrderItemRequest[], promo: Promo | null, enabled: boolean) {
  const [settled, setSettled] = useState<Settled | null>(null);
  const active = enabled && promo !== null && items.length > 0;
  const key = active ? JSON.stringify([eventId, items, promo]) : "";

  useEffect(() => {
    if (!key) return;
    const [id, quotedItems, quotedPromo] = JSON.parse(key) as [string, OrderItemRequest[], Promo];
    let current = true;
    // Short delay so holding "+" does not send one request per click.
    const timer = setTimeout(() => {
      campaignsApi.quote(id, quotedItems, quotedPromo).then(
        (quote) => current && setSettled({ key, quote, error: null }),
        (error: unknown) => current && setSettled({ key, quote: null, error }),
      );
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key]);

  const ready = active && settled?.key === key;
  return {
    quote: ready ? settled.quote : null,
    error: ready ? settled.error : null,
    loading: active && !ready,
  };
}
