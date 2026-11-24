import { apiBlob, apiRequest } from "./client";
import type {
  AuditEntry,
  Campaign,
  CampaignAnalytics,
  CampaignPayload,
  CampaignResolution,
  Event,
  EventAdmin,
  EventAnalytics,
  EventAttendee,
  EventInventory,
  EventPayload,
  EventPreview,
  EventSummary,
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
  PayoutAccount,
  PayoutAccountCreate,
  PromoQuote,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationResponse,
  Ticket,
  TicketType,
  TicketTypePayload,
  TimelineEntry,
  TokenResponse,
  User,
} from "./types";

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
  updateMe: (body: { first_name?: string; last_name?: string }) =>
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
};

export const eventsApi = {
  listOwn: (limit = 100, offset = 0) => apiRequest<EventSummary[]>("/events", { query: { limit, offset } }),
  get: (id: string) => apiRequest<Event>(`/events/${id}`),
  create: (body: EventPayload) => apiRequest<Event>("/events", { method: "POST", body }),
  update: (id: string, body: Partial<EventPayload>) =>
    apiRequest<Event>(`/events/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/events/${id}`, { method: "DELETE" }),
  duplicate: (id: string) => apiRequest<Event>(`/events/${id}/duplicate`, { method: "POST" }),
  preview: (id: string) => apiRequest<EventPreview>(`/events/${id}/preview`),
  publish: (id: string) => apiRequest<Event>(`/events/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) => apiRequest<Event>(`/events/${id}/unpublish`, { method: "POST" }),
  cancel: (id: string) => apiRequest<Event>(`/events/${id}/cancel`, { method: "POST" }),
  inventory: (id: string) => apiRequest<EventInventory>(`/events/${id}/inventory`),
  attendees: (id: string, limit = 500, offset = 0) =>
    apiRequest<EventAttendee[]>(`/events/${id}/attendees`, { query: { limit, offset } }),
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
  list: (limit = 100, offset = 0) => apiRequest<EventSummary[]>("/events/catalog", { query: { limit, offset } }),
  event: (id: string) => apiRequest<Event>(`/events/${id}`),
  ticketTypes: (eventId: string) => apiRequest<TicketType[]>(`/events/${eventId}/ticket-types`),
};

export const ordersApi = {
  create: (body: OrderCreateRequest) => apiRequest<Order>("/orders", { method: "POST", body }),
  get: (id: string) => apiRequest<Order>(`/orders/${id}`),
  /** Demo payment: no real provider is contacted. Repeating returns the same payment. */
  startPayment: (id: string) => apiRequest<PaymentSimulation>(`/orders/${id}/payments/simulate`, { method: "POST" }),
  resolvePayment: (paymentId: string, outcome: PaymentOutcome) =>
    apiRequest<Payment>(`/orders/payments/${paymentId}/simulate-result`, { method: "POST", body: { outcome } }),
  /** Marks the tickets CANCELLED. The backend allows this for the buyer only. */
  cancel: (id: string) => apiRequest<Order>(`/orders/${id}/cancel`, { method: "POST" }),
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
