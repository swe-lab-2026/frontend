// Mirrors the Pydantic schemas in swe-lab-2026/backend (app/schemas/*).
// Decimal fields arrive as strings; datetimes are ISO-8601 strings with offset.

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type RegisterRequest = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type RegisterResponse = {
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  code_expires_in: number;
};

export type ResendVerificationResponse = {
  email: string;
  code_expires_in: number;
  retry_after: number;
};

export type GlobalRole = "USER" | "PLATFORM_ADMIN" | string;

export type User = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  global_role: GlobalRole;
  status: string;
  email_verified_at: string | null;
  created_at: string;
};

export type OrganizerProfile = {
  user_id: string;
  display_name: string;
  legal_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  verification_status: string;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizerProfileCreate = {
  display_name: string;
  legal_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  terms_accepted: boolean;
};

export type OrganizerProfileUpdate = Partial<Omit<OrganizerProfileCreate, "terms_accepted">>;

export type PayoutAccountCreate = {
  provider: string;
  external_account_ref: string;
  is_default: boolean;
};

export type PayoutAccount = {
  id: string;
  provider: string;
  external_account_ref: string;
  status: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type EventVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type EventStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "CANCELLED" | "COMPLETED";

export type EventImage = {
  id: string;
  object_key: string;
  alt_text: string | null;
  sort_order: number;
};

export type EventImageInput = {
  object_key: string;
  alt_text?: string | null;
  sort_order?: number;
};

export type EventPayload = {
  title: string;
  description: string | null;
  category: string | null;
  visibility: EventVisibility;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  country_code: string | null;
  timezone: string;
  starts_at: string;
  ends_at: string;
  registration_starts_at: string | null;
  registration_ends_at: string | null;
  capacity: number | null;
  refund_policy: string | null;
  images: EventImageInput[];
};

export type Event = Omit<EventPayload, "images" | "visibility"> & {
  id: string;
  owner_user_id: string;
  visibility: EventVisibility;
  status: EventStatus;
  latitude: string | null;
  longitude: string | null;
  published_at: string | null;
  images: EventImage[];
  created_at: string;
  updated_at: string;
};

export type EventSummary = {
  id: string;
  title: string;
  visibility: EventVisibility;
  status: EventStatus;
  starts_at: string;
  ends_at: string;
  venue_name: string | null;
  city: string | null;
  timezone: string;
  capacity: number | null;
  created_at: string;
  updated_at: string;
};

export type TicketTypePayload = {
  name: string;
  description: string | null;
  price: string;
  currency: string;
  capacity: number;
  min_per_order: number;
  max_per_order: number;
  sales_starts_at: string | null;
  sales_ends_at: string | null;
  is_hidden: boolean;
};

export type TicketType = TicketTypePayload & {
  id: string;
  event_id: string;
  is_free: boolean;
  created_at: string;
  updated_at: string;
};

export type TicketTypeInventory = {
  ticket_type_id: string;
  name: string;
  is_hidden: boolean;
  capacity: number;
  reserved: number;
  sold: number;
  returned: number;
  checked_in: number;
  available: number;
};

export type EventInventory = {
  event_id: string;
  event_capacity: number | null;
  total_sold: number;
  total_reserved: number;
  total_available: number;
  ticket_types: TicketTypeInventory[];
};

export type EventPreview = {
  event: Event;
  ticket_types: TicketType[];
  publish_ready: boolean;
  validation_errors: string[];
};

export type EventAdmin = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: Record<string, unknown>;
  assigned_at: string;
};

export type ValidationIssue = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details: { errors?: ValidationIssue[] | string[]; [key: string]: unknown };
  };
};
