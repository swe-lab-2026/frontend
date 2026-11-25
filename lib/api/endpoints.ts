import { ApiError, apiBlob, apiFile, apiRequest } from "./client";
import type {
  AdminAction,
  AdminActivation,
  AdminCampaign,
  AdminDispute,
  AdminEvent,
  AdminEventAction,
  AdminEventReport,
  AdminFailure,
  AdminOrder,
  AdminPayment,
  AdminPayoutAccount,
  AdminRefund,
  AdminUser,
  AppNotification,
  AuditEntry,
  Campaign,
  CampaignAnalytics,
  CampaignPayload,
  CampaignResolution,
  DisputeStatus,
  Event,
  EventAdmin,
  EventAnalytics,
  EventAttendee,
  EmailLocale,
  EventCancellation,
  EventImageUpload,
  EventInventory,
  EventPayload,
  EventPreview,
  EventReport,
  EventSummary,
  NotificationPage,
  Order,
  OrderCreateRequest,
  OrderItemRequest,
  OrganizerProfile,
  OrganizerProfileCreate,
  OrganizerProfileUpdate,
  Page,
  Payment,
  PaymentOutcome,
  PaymentSimulation,
  PaidSalesActivation,
  PayoutAccount,
  PayoutAccountCreate,
  PayoutStatus,
  PlatformSettings,
  PromoQuote,
  Refund,
  RefundEligibility,
  RefundPolicy,
  RefundPolicyUpdate,
  RefundResult,
  RegisterRequest,
  RegisterResponse,
  ReportReason,
  ReportStatus,
  ResendVerificationResponse,
  SupportAssignable,
  SupportCase,
  SupportCaseCreate,
  SupportMessage,
  SupportMessagePage,
  SupportStatus,
  Ticket,
  TicketType,
  TicketTypePayload,
  TimelineEntry,
  TokenResponse,
  User,
} from "./types";

/** For lists without a total: reads pages until one is not full. `size` is the server's maximum. */
export async function allPages<T>(size: number, load: (query: { limit: number; offset: number }) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = await load({ limit: size, offset: rows.length });
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

export const authApi = {
  register: (body: RegisterRequest) =>
    apiRequest<RegisterResponse>("/auth/register", { method: "POST", body, auth: false }),
  verifyEmail: (email: string, code: string) =>
    apiRequest<{ email: string; email_verified: boolean }>("/auth/verify-email", {
      method: "POST",
      body: { email, code },
      auth: false,
    }),
  resendVerification: (email: string) =>
    apiRequest<ResendVerificationResponse>("/auth/resend-verification", {
      method: "POST",
      body: { email },
      auth: false,
    }),
  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  /** Always succeeds for a well-formed email, so it never reveals whether an account exists. */
  requestPasswordReset: (email: string) =>
    apiRequest<{ email: string; code_expires_in: number; retry_after: number }>("/auth/request-password-reset", {
      method: "POST",
      body: { email },
      auth: false,
    }),
  resetPassword: (email: string, token: string, newPassword: string) =>
    apiRequest<{ email: string }>("/auth/reset-password", {
      method: "POST",
      body: { email, token, new_password: newPassword },
      auth: false,
    }),
  logout: (refreshToken: string) =>
    apiRequest<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
      auth: false,
    }),
};

export const usersApi = {
  me: () => apiRequest<User>("/users/me"),
  reports: (limit: number, offset: number) => apiRequest<Page<EventReport>>("/users/me/reports", { query: { limit, offset } }),
  updateMe: (body: { first_name?: string; last_name?: string; locale?: EmailLocale }) =>
    apiRequest<User>("/users/me", { method: "PATCH", body }),
};

export const organizersApi = {
  me: () => apiRequest<OrganizerProfile>("/organizers/me"),
  create: (body: OrganizerProfileCreate) =>
    apiRequest<OrganizerProfile>("/organizers/me", { method: "POST", body }),
  update: (body: OrganizerProfileUpdate) =>
    apiRequest<OrganizerProfile>("/organizers/me", { method: "PATCH", body }),
  upsertPayoutAccount: (body: PayoutAccountCreate) =>
    apiRequest<PayoutAccount>("/organizers/me/payout-account", { method: "PUT", body }),
  /** The default account, or the newest one. The reference is masked. */
  payoutAccount: () => apiRequest<PayoutAccount>("/organizers/me/payout-account"),
  /** DEMO: no identity check happens. Can be switched off on the server. */
  simulateVerification: () => apiRequest<OrganizerProfile>("/organizers/me/verification/simulate", { method: "POST" }),
  /** DEMO: no bank check happens. Can be switched off on the server. */
  simulatePayoutApproval: () => apiRequest<PayoutAccount>("/organizers/me/payout-account/simulate-approval", { method: "POST" }),
};

/** Null when the organizer has not added a payout account yet. */
export function fetchPayoutAccount(): Promise<PayoutAccount | null> {
  return organizersApi.payoutAccount().catch((err: unknown) => {
    if (err instanceof ApiError && err.code === "PAYOUT_ACCOUNT_NOT_FOUND") return null;
    throw err;
  });
}

/** Event owner only. Activation covers one event. */
export const paidSalesApi = {
  status: (eventId: string) => apiRequest<PaidSalesActivation>(`/events/${eventId}/paid-sales/activation`),
  acceptTerms: (eventId: string) =>
    apiRequest<PaidSalesActivation>(`/events/${eventId}/paid-sales/terms`, { method: "POST", body: { accepted: true } }),
  /** DEMO: no money is charged. */
  payFee: (eventId: string) => apiRequest<PaidSalesActivation>(`/events/${eventId}/paid-sales/activation-fee`, { method: "POST" }),
  activate: (eventId: string) => apiRequest<PaidSalesActivation>(`/events/${eventId}/paid-sales/activate`, { method: "POST" }),
};

export const eventsApi = {
  listOwn: () => allPages(100, (query) => apiRequest<EventSummary[]>("/events", { query })),
  get: (id: string) => apiRequest<Event>(`/events/${id}`),
  create: (body: EventPayload) => apiRequest<Event>("/events", { method: "POST", body }),
  update: (id: string, body: Partial<EventPayload>) =>
    apiRequest<Event>(`/events/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/events/${id}`, { method: "DELETE" }),
  duplicate: (id: string) => apiRequest<Event>(`/events/${id}/duplicate`, { method: "POST" }),
  preview: (id: string) => apiRequest<EventPreview>(`/events/${id}/preview`),
  publish: (id: string) => apiRequest<Event>(`/events/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) => apiRequest<Event>(`/events/${id}/unpublish`, { method: "POST" }),
  /** Refunds every paid order (demo). Repeating it resumes unfinished work and never refunds twice. */
  cancel: (id: string, reason?: string) =>
    apiRequest<Event>(`/events/${id}/cancel`, { method: "POST", body: { reason: reason || null } }),
  cancellation: (id: string) => apiRequest<EventCancellation>(`/events/${id}/cancellation`),
  refundPolicy: (id: string) => apiRequest<RefundPolicy>(`/events/${id}/refund-policy`),
  updateRefundPolicy: (id: string, body: RefundPolicyUpdate) =>
    apiRequest<RefundPolicy>(`/events/${id}/refund-policy`, { method: "PUT", body }),
  /** Stores the file only; the returned key must still be saved in the event's `images`. */
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<EventImageUpload>(`/events/${id}/images/upload`, { method: "POST", body: form });
  },
  inventory: (id: string) => apiRequest<EventInventory>(`/events/${id}/inventory`),
  attendees: (id: string) => allPages(500, (query) => apiRequest<EventAttendee[]>(`/events/${id}/attendees`, { query })),
  /** `start` inclusive, `end` exclusive, both with a UTC offset. */
  analytics: (id: string, query: { start?: string; end?: string; ticket_type_id?: string } = {}) =>
    apiRequest<EventAnalytics>(`/events/${id}/analytics`, { query }),
  /** Newest first. An `action` ending in "." is a prefix. */
  timeline: (id: string, query: { action?: string[]; start?: string; end?: string; limit?: number; offset?: number }) =>
    apiRequest<Page<TimelineEntry>>(`/events/${id}/timeline`, { query }),
  auditLog: (id: string, action: string) => apiRequest<AuditEntry[]>(`/events/${id}/audit-log`, { query: { action, limit: 200 } }),
};

export const campaignsApi = {
  list: (eventId: string) => apiRequest<Campaign[]>(`/events/${eventId}/campaigns`),
  create: (eventId: string, body: CampaignPayload) =>
    apiRequest<Campaign>(`/events/${eventId}/campaigns`, { method: "POST", body }),
  setActive: (eventId: string, id: string, isActive: boolean) =>
    apiRequest<Campaign>(`/events/${eventId}/campaigns/${id}`, { method: "PATCH", body: { is_active: isActive } }),
  analytics: (eventId: string) => apiRequest<CampaignAnalytics[]>(`/events/${eventId}/campaigns/analytics`),
  /** Public: what a scanned Campaign QR points at. */
  resolve: (token: string) => apiRequest<CampaignResolution>(`/campaigns/qr/${encodeURIComponent(token)}`),
  /** Server-side validation and price preview; needs a signed-in user. */
  quote: (eventId: string, items: OrderItemRequest[], promo: { code: string } | { campaign_token: string }) =>
    apiRequest<PromoQuote>("/campaigns/validate", { method: "POST", body: { event_id: eventId, items, ...promo } }),
};

// Attendee-facing reads. The token is still sent when present (the backend
// treats it as optional), so an organizer previewing their own event works too.
export const catalogApi = {
  /** Oldest first, and events that already ended are included. */
  list: () => allPages(100, (query) => apiRequest<EventSummary[]>("/events/catalog", { query })),
  event: (id: string) => apiRequest<Event>(`/events/${id}`),
  ticketTypes: (eventId: string) => apiRequest<TicketType[]>(`/events/${eventId}/ticket-types`),
  /** Fetched rather than linked, so private events work too. */
  calendar: (id: string) => apiBlob(`/events/${id}/calendar.ics`),
  report: (id: string, reason: ReportReason, details: string | null) =>
    apiRequest<EventReport>(`/events/${id}/reports`, { method: "POST", body: { reason, details } }),
};

export const notificationsApi = {
  list: (query: { unread_only?: boolean; limit?: number; offset?: number } = {}) =>
    apiRequest<NotificationPage>("/users/me/notifications", { query }),
  markRead: (id: string) => apiRequest<AppNotification>(`/users/me/notifications/${id}/read`, { method: "POST" }),
};

export const ordersApi = {
  create: (body: OrderCreateRequest) => apiRequest<Order>("/orders", { method: "POST", body }),
  get: (id: string) => apiRequest<Order>(`/orders/${id}`),
  /** Demo payment: no real provider is contacted. Repeating returns the same payment. */
  startPayment: (id: string) => apiRequest<PaymentSimulation>(`/orders/${id}/payments/simulate`, { method: "POST" }),
  resolvePayment: (paymentId: string, outcome: PaymentOutcome) =>
    apiRequest<Payment>(`/orders/payments/${paymentId}/simulate-result`, { method: "POST", body: { outcome } }),
  /** Cancels every ticket of the order. Allowed for the buyer and the event owner. */
  cancel: (id: string) => apiRequest<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  /** DEMO full refund of a paid order. A repeat returns the first result. */
  refund: (id: string) => apiRequest<RefundResult>(`/orders/${id}/refund`, { method: "POST" }),
  refunds: (id: string) => apiRequest<Refund[]>(`/orders/${id}/refunds`),
  refundEligibility: (id: string) => apiRequest<RefundEligibility>(`/orders/${id}/refund-eligibility`),
  /** The signed-in user's orders, newest first. The backend scopes by buyer. */
  list: (limit = 200, offset = 0) => apiRequest<Order[]>("/orders", { query: { limit, offset } }),
};

export const ticketsApi = {
  list: (limit = 500, offset = 0) => apiRequest<Ticket[]>("/tickets", { query: { limit, offset } }),
  get: (publicId: string) => apiRequest<Ticket>(`/tickets/${publicId}`),
  /** Read-only GET: downloading again returns the same ticket, never a new one. */
  pdf: (publicId: string) => apiBlob(`/tickets/${publicId}/pdf`),
};

export const ticketTypesApi = {
  list: (eventId: string) => apiRequest<TicketType[]>(`/events/${eventId}/ticket-types`),
  create: (eventId: string, body: TicketTypePayload) =>
    apiRequest<TicketType>(`/events/${eventId}/ticket-types`, { method: "POST", body }),
  update: (eventId: string, id: string, body: Partial<TicketTypePayload>) =>
    apiRequest<TicketType>(`/events/${eventId}/ticket-types/${id}`, { method: "PATCH", body }),
  /** Backend "DELETE" hides the ticket type; it is never hard-deleted. */
  hide: (eventId: string, id: string) =>
    apiRequest<void>(`/events/${eventId}/ticket-types/${id}`, { method: "DELETE" }),
};

export const eventAdminsApi = {
  list: (eventId: string) => apiRequest<EventAdmin[]>(`/events/${eventId}/admins`),
  assign: (eventId: string, email: string) =>
    apiRequest<EventAdmin>(`/events/${eventId}/admins`, { method: "POST", body: { email } }),
  remove: (eventId: string, userId: string) =>
    apiRequest<void>(`/events/${eventId}/admins/${userId}`, { method: "DELETE" }),
};

export type SupportQuery = {
  status?: string[];
  category?: string;
  event_id?: string;
  role?: "requester" | "handler";
  q?: string;
  limit?: number;
  offset?: number;
};

export const supportApi = {
  list: (query: SupportQuery) => apiRequest<Page<SupportCase>>("/support/cases", { query }),
  create: (body: SupportCaseCreate) => apiRequest<SupportCase>("/support/cases", { method: "POST", body }),
  get: (id: string) => apiRequest<SupportCase>(`/support/cases/${id}`),
  messages: (id: string, afterSequence: number) =>
    apiRequest<SupportMessagePage>(`/support/cases/${id}/messages`, { query: { after_sequence: afterSequence, limit: 100 } }),
  send: (id: string, body: string) => apiRequest<SupportMessage>(`/support/cases/${id}/messages`, { method: "POST", body: { body } }),
  setStatus: (id: string, status: SupportStatus) => apiRequest<SupportCase>(`/support/cases/${id}/status`, { method: "PATCH", body: { status } }),
  assignable: (id: string) => apiRequest<SupportAssignable[]>(`/support/cases/${id}/assignable-users`),
  assign: (id: string, userId: string | null) =>
    apiRequest<SupportCase>(`/support/cases/${id}/assignee`, { method: "PATCH", body: { assignee_user_id: userId } }),
  escalate: (id: string, reason: string) => apiRequest<SupportCase>(`/support/cases/${id}/escalate`, { method: "POST", body: { reason } }),
};

export type AdminQuery = { q?: string; limit: number; offset: number; [filter: string]: string | number | undefined };

/** The lists the server can export itself. */
export type AdminExportKind = "users" | "events" | "orders" | "payments";

/** Every route answers 403 unless the caller is a PLATFORM_ADMIN. */
export const adminApi = {
  users: (query: AdminQuery) => apiRequest<Page<AdminUser>>("/admin/users", { query }),
  suspendUser: (id: string, reason: string) => apiRequest<AdminUser>(`/admin/users/${id}/suspend`, { method: "POST", body: { reason } }),
  unsuspendUser: (id: string, reason: string) => apiRequest<AdminUser>(`/admin/users/${id}/unsuspend`, { method: "POST", body: { reason } }),
  events: (query: AdminQuery) => apiRequest<Page<AdminEvent>>("/admin/events", { query }),
  suspendEvent: (id: string, reason: string) => apiRequest<AdminEventAction>(`/admin/events/${id}/suspend`, { method: "POST", body: { reason } }),
  unsuspendEvent: (id: string, reason: string) => apiRequest<AdminEventAction>(`/admin/events/${id}/unsuspend`, { method: "POST", body: { reason } }),
  stopPaidSales: (id: string, reason: string) => apiRequest<AdminEventAction>(`/admin/events/${id}/paid-sales/stop`, { method: "POST", body: { reason } }),
  resumePaidSales: (id: string, reason: string) => apiRequest<AdminEventAction>(`/admin/events/${id}/paid-sales/resume`, { method: "POST", body: { reason } }),
  orders: (query: AdminQuery) => apiRequest<Page<AdminOrder>>("/admin/orders", { query }),
  payments: (query: AdminQuery) => apiRequest<Page<AdminPayment>>("/admin/payments", { query }),
  activations: (query: AdminQuery) => apiRequest<Page<AdminActivation>>("/admin/activations", { query }),
  refunds: (query: AdminQuery) => apiRequest<Page<AdminRefund>>("/admin/refunds", { query }),
  disputes: (query: AdminQuery) => apiRequest<Page<AdminDispute>>("/admin/disputes", { query }),
  openDispute: (paymentId: string, reason: string) =>
    apiRequest<AdminDispute>("/admin/disputes", { method: "POST", body: { payment_id: paymentId, reason } }),
  updateDispute: (id: string, status: DisputeStatus, note?: string) =>
    apiRequest<AdminDispute>(`/admin/disputes/${id}`, { method: "PATCH", body: { status, resolution_note: note } }),
  setVerification: (userId: string, status: "VERIFIED" | "REJECTED", reason: string) =>
    apiRequest<OrganizerProfile>(`/admin/organizers/${userId}/verification`, { method: "POST", body: { status, reason } }),
  payoutAccounts: (query: AdminQuery) => apiRequest<Page<AdminPayoutAccount>>("/admin/payout-accounts", { query }),
  setPayoutStatus: (accountId: string, status: PayoutStatus, reason: string) =>
    apiRequest<PayoutAccount>(`/admin/payout-accounts/${accountId}/status`, { method: "POST", body: { status, reason } }),
  reports: (query: AdminQuery) => apiRequest<Page<AdminEventReport>>("/admin/reports", { query }),
  updateReport: (id: string, status: ReportStatus, note?: string, suspendEvent = false) =>
    apiRequest<AdminEventReport>(`/admin/reports/${id}`, {
      method: "PATCH",
      body: { status, resolution_note: note, suspend_event: suspendEvent },
    }),
  campaigns: (query: AdminQuery) => apiRequest<Page<AdminCampaign>>("/admin/campaigns", { query }),
  /** Recorded in the admin log. `X-Truncated` tells whether the row limit cut the file. */
  exportCsv: (kind: AdminExportKind, query: { q?: string; status?: string }) => apiFile(`/admin/export/${kind}.csv`, { query }),
  settings: () => apiRequest<PlatformSettings>("/admin/settings"),
  updateSettings: (body: { activation_fee_amount?: string; processing_fee_percent?: string; reason: string | null }) =>
    apiRequest<PlatformSettings>("/admin/settings", { method: "PATCH", body }),
  failures: (query: AdminQuery) => apiRequest<Page<AdminFailure>>("/admin/failures", { query }),
  escalated: (query: AdminQuery) => apiRequest<Page<SupportCase>>("/admin/support/escalated", { query }),
  actions: (query: AdminQuery) => apiRequest<Page<AdminAction>>("/admin/actions", { query }),
};
