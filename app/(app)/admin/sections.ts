export const ADMIN_SECTIONS = ["users", "events", "orders", "payments", "activations", "payouts", "refunds", "disputes", "reports", "failures", "campaigns", "support", "settings", "actions"] as const;
export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number];
