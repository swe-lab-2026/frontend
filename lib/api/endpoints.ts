import { apiRequest } from "./client";
import type {
  Event,
  EventAdmin,
  EventInventory,
  EventPayload,
  EventPreview,
  EventSummary,
  OrganizerProfile,
  OrganizerProfileCreate,
  OrganizerProfileUpdate,
  PayoutAccount,
  PayoutAccountCreate,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationResponse,
  TicketType,
  TicketTypePayload,
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
