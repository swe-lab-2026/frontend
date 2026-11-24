export const ADMIN_SECTIONS = ["users", "events", "orders", "payments", "activations", "refunds", "failures", "campaigns", "support", "actions"] as const;
export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number];
