import type { Campaign, CampaignStatus, DiscountType } from "@/lib/api/types";
import { formatMoney } from "@/lib/registration";
import type { BadgeTone } from "@/lib/tickets";
import { PRICE_RE } from "@/lib/validation";

// Mirrors PROMO_CODE_PATTERN in backend app/schemas/campaigns.py.
export const PROMO_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;

/** "10%" or "500 ₸". Display only: amounts are always computed by the server. */
export function discountLabel(type: DiscountType, value: string, intlLocale: string): string {
  if (type === "PERCENT") return `${new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(Number(value))}%`;
  return formatMoney(value, "KZT", intlLocale);
}

const TONES: Record<CampaignStatus, BadgeTone> = {
  ACTIVE: "success",
  SCHEDULED: "info",
  EXPIRED: "neutral",
  DISABLED: "danger",
  EXHAUSTED: "warning",
};

export function campaignTone(status: CampaignStatus): BadgeTone {
  return TONES[status] ?? "neutral";
}

/** The server's link, or this site's own origin while the server has none configured. */
export function campaignLink(campaign: Pick<Campaign, "qr_url" | "qr_path">, origin: string): string {
  return campaign.qr_url ?? `${origin}${campaign.qr_path}`;
}

export type CampaignForm = {
  name: string;
  code: string;
  discount_type: DiscountType;
  discount_value: string;
  starts_at: string;
  expires_at: string;
  redemption_limit: string;
  limitTypes: boolean;
  ticket_type_ids: string[];
};

export type CampaignFormError = "required" | "code" | "percent" | "price" | "endAfterStart" | "positive" | "pickType";

export function validateCampaign(form: CampaignForm): Partial<Record<keyof CampaignForm, CampaignFormError>> {
  const errors: Partial<Record<keyof CampaignForm, CampaignFormError>> = {};
  const value = form.discount_value.replace(",", ".");
  if (!form.name.trim()) errors.name = "required";
  if (!PROMO_CODE_RE.test(form.code.trim())) errors.code = "code";
  if (!PRICE_RE.test(value) || Number(value) <= 0) errors.discount_value = "price";
  else if (form.discount_type === "PERCENT" && Number(value) > 100) errors.discount_value = "percent";
  if (form.starts_at && form.expires_at && form.expires_at <= form.starts_at) errors.expires_at = "endAfterStart";
  if (form.redemption_limit && !(Number.isInteger(Number(form.redemption_limit)) && Number(form.redemption_limit) > 0)) {
    errors.redemption_limit = "positive";
  }
  if (form.limitTypes && form.ticket_type_ids.length === 0) errors.ticket_type_ids = "pickType";
  return errors;
}
