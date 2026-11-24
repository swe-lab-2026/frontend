import { describe, expect, it } from "vitest";
import { type CampaignForm, campaignLink, discountLabel, PROMO_CODE_RE, validateCampaign } from "@/lib/campaigns";

const form = (over: Partial<CampaignForm> = {}): CampaignForm => ({
  name: "Spring", code: "SPRING10", discount_type: "PERCENT", discount_value: "10", starts_at: "", expires_at: "",
  redemption_limit: "", limitTypes: false, ticket_type_ids: [], ...over,
});

describe("validateCampaign", () => {
  it("accepts a minimal campaign", () => expect(validateCampaign(form())).toEqual({}));
  it.each([
    [{ name: "  " }, { name: "required" }],
    [{ code: "AB" }, { code: "code" }],
    [{ code: "СКИДКА" }, { code: "code" }],
    [{ discount_value: "0" }, { discount_value: "price" }],
    [{ discount_value: "10.555" }, { discount_value: "price" }],
    [{ discount_value: "100.01" }, { discount_value: "percent" }],
    [{ discount_value: "100" }, {}],
    [{ discount_value: "12,5" }, {}],
    [{ discount_type: "FIXED" as const, discount_value: "5000" }, {}],
    [{ starts_at: "2026-12-02T10:00", expires_at: "2026-12-02T10:00" }, { expires_at: "endAfterStart" }],
    [{ redemption_limit: "0" }, { redemption_limit: "positive" }],
    [{ redemption_limit: "1.5" }, { redemption_limit: "positive" }],
    [{ limitTypes: true }, { ticket_type_ids: "pickType" }],
  ])("%j -> %j", (over, errors) => expect(validateCampaign(form(over))).toEqual(errors));
});

describe("campaign helpers", () => {
  it("matches the backend code pattern", () => {
    expect(PROMO_CODE_RE.test("a-B_9")).toBe(true);
    expect(PROMO_CODE_RE.test("-abc")).toBe(false);
    expect(PROMO_CODE_RE.test("a".repeat(41))).toBe(false);
  });
  it("prefers the server link and falls back to this origin", () => {
    expect(campaignLink({ qr_url: "https://x.kz/campaigns/t", qr_path: "/campaigns/t" }, "http://localhost")).toBe("https://x.kz/campaigns/t");
    expect(campaignLink({ qr_url: null, qr_path: "/campaigns/t" }, "http://localhost")).toBe("http://localhost/campaigns/t");
  });
  it("labels percentages", () => expect(discountLabel("PERCENT", "12.50", "en-GB")).toBe("12.5%"));
});
