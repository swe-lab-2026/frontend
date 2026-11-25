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

/** The paid-sales checklist of one event (SRS 4.5). */
export type PaidSalesActivation = {
  event_id: string;
  verification_complete: boolean;
  payout_account_complete: boolean;
  activation_fee_amount: string;
  activation_fee_paid: boolean;
  terms_accepted: boolean;
  is_activated: boolean;
  activated_at: string | null;
  sales_suspended: boolean;
  sales_suspended_at: string | null;
  sales_suspension_reason: string | null;
  event_suspended: boolean;
  /** Buyers can pay right now. */
  paid_sales_open: boolean;
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

export type EventImageUpload = { object_key: string; url: string; content_type: string; size_bytes: number; width: number; height: number };

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
  /** Suspended by the platform: hidden from the public and not on sale. */
  is_suspended: boolean;
  /** Paid checkout is open: activated, not stopped, event not suspended. */
  paid_sales_active: boolean;
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
  is_suspended: boolean;
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
  /** Tickets that can still be bought right now. Only the list endpoint sends it. */
  available: number | null;
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

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | string;

export type TicketStatus = "VALID" | "CHECKED_IN" | "CANCELLED" | "REFUNDED" | string;

/** An issued admission ticket. Holds no payment data by design (SRS 4.7). */
export type Ticket = {
  ticket_id: string;
  /** The identifier shown to people and printed on the PDF. */
  public_id: string;
  order_id: string;
  order_number: number;
  event_id: string;
  event_title: string;
  event_starts_at: string;
  event_ends_at: string;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  timezone: string;
  ticket_type_id: string;
  ticket_type_name: string;
  attendee_name: string | null;
  attendee_email: string;
  status: TicketStatus;
  issued_at: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
  /** Signed string encoded into the QR code; the scanner app verifies it. */
  qr_payload: string;
  download_url: string;
  /** Assigned seat, e.g. "Section A · Row 3 · Seat 12". Not sent by the API yet. */
  seat_label?: string | null;
};

export type OrderItemRequest = { ticket_type_id: string; quantity: number };

export type AttendeeRequest = { ticket_type_id: string; full_name: string; email: string };

/** At most one of `promo_code` / `campaign_token`; the server prices the order. */
export type OrderCreateRequest = {
  event_id: string;
  items: OrderItemRequest[];
  promo_code?: string;
  campaign_token?: string;
  /** One entry per ticket. Left out: every ticket is issued to the buyer. */
  attendees?: AttendeeRequest[];
};

export type OrderItem = {
  ticket_type_id: string;
  ticket_type_name: string;
  quantity: number;
  unit_price: string;
  /** Sum of the line after discounts (units can be discounted unevenly). */
  subtotal: string;
  final_price: string;
};

export type Order = {
  id: string;
  order_number: number;
  event_id: string;
  status: OrderStatus;
  currency: string;
  subtotal_amount: string;
  discount_amount: string;
  fee_amount: string;
  total_amount: string;
  is_free: boolean;
  campaign_id: string | null;
  /** The code as it was when the order was placed. */
  promo_code: string | null;
  /** Set only for unpaid orders: when the inventory hold is released. */
  expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  items: OrderItem[];
  /** Issued tickets; empty until the order is confirmed. */
  tickets: Ticket[];
};

export type EventAttendee = {
  attendee_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  registered_at: string;
  order_id: string;
  order_number: number;
  currency: string;
  total_amount: string;
  ticket_count: number;
};

// ---------- Simulated payments ----------

export type PaymentOutcome = "success" | "failed" | "abandoned";

export type PaymentSimulation = {
  payment_id: string;
  order_id: string;
  amount: string;
  currency: string;
  status: string;
  is_simulated: boolean;
};

export type Payment = {
  id: string;
  order_id: string;
  amount: string;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED" | string;
  is_simulated: boolean;
  failure_code: string | null;
};

// ---------- Refunds (simulated) ----------

export type RefundPolicy = {
  event_id: string;
  refunds_enabled: boolean;
  /** Null counts as 0: until the event starts. */
  refund_deadline_hours: number | null;
  refund_deadline: string | null;
  policy_text: string | null;
};

export type RefundPolicyUpdate = { refunds_enabled: boolean; refund_deadline_hours: number | null; policy_text: string | null };

export type RefundKind = "CUSTOMER_REQUEST" | "EVENT_CANCELLATION" | "ORGANIZER_REQUEST" | string;

export type Refund = {
  id: string;
  order_id: string;
  payment_id: string;
  amount: string;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | string;
  kind: RefundKind;
  reason: string | null;
  is_simulated: boolean;
  created_at: string;
  completed_at: string | null;
};

/** What cancelling or refunding would do for the signed-in user; changes nothing. */
export type RefundEligibility = {
  order_id: string;
  cancellable: boolean;
  refundable: boolean;
  /** Error code of the first rule that blocks it. */
  reason: string | null;
  refund_amount: string;
  currency: string;
  refunds_enabled: boolean;
  refund_deadline: string | null;
};

export type RefundResult = { order_id: string; order_status: OrderStatus; refund: Refund | null; replayed: boolean };

/** Progress of closing the orders of a cancelled event. */
export type EventCancellation = {
  event_id: string;
  event_status: EventStatus;
  cancelled_at: string | null;
  reason: string | null;
  orders_remaining: number;
  orders_refunded: number;
  orders_cancelled: number;
  event_cancellation_refund_total: string;
  complete: boolean;
};

// ---------- In-app notifications ----------

export type AppNotification = {
  id: string;
  type: string;
  /** Depends on `type`; every value is optional and read defensively. */
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

export type NotificationPage = Page<AppNotification> & { unread_count: number };

// ---------- Reported events ----------

export const REPORT_REASONS = ["FRAUD", "MISLEADING", "INAPPROPRIATE", "PROHIBITED", "SPAM", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export type EventReport = {
  id: string;
  event_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
};

// ---------- Promo campaigns ----------

export type DiscountType = "PERCENT" | "FIXED";
export type CampaignStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED" | "EXHAUSTED";

export type CampaignPayload = {
  name: string;
  code: string;
  discount_type: DiscountType;
  discount_value: string;
  starts_at: string | null;
  expires_at: string | null;
  redemption_limit: number | null;
  /** Empty = every ticket type of the event. */
  ticket_type_ids: string[];
};

export type Campaign = Omit<CampaignPayload, "code"> & {
  id: string;
  event_id: string;
  code: string | null;
  redemption_count: number;
  remaining_redemptions: number | null;
  is_active: boolean;
  effective_status: CampaignStatus;
  campaign_token: string;
  qr_path: string;
  /** Null until the backend's PUBLIC_WEB_BASE_URL is configured. */
  qr_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignAnalytics = {
  campaign_id: string;
  promo_code: string | null;
  currency: string;
  redemption_limit: number | null;
  redemption_count: number;
  reserved_redemptions: number;
  successful_redemptions: number;
  released_redemptions: number;
  discount_total: string;
  attributed_order_count: number;
  attributed_revenue: string;
  gross_attributed_order_count: number;
  gross_attributed_revenue: string;
  reversed_order_count: number;
  reversed_revenue: string;
};

/** Public resolution of a scanned Campaign QR; carries no code or counts. */
export type CampaignResolution = {
  event: { id: string; title: string };
  promotion: {
    campaign_token: string;
    name: string;
    discount_type: DiscountType;
    discount_value: string;
    expires_at: string | null;
    applies_to_all_ticket_types: boolean;
    ticket_type_ids: string[];
  };
};

/** Server-calculated price preview; never consumes a redemption. */
export type PromoQuote = {
  campaign_id: string;
  code: string | null;
  discount_type: DiscountType;
  discount_value: string;
  currency: string;
  subtotal: string;
  discount_amount: string;
  fee_amount: string;
  final_total: string;
};

// ---------- Organizer analytics and history ----------

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

/** Realized sales for the period in one currency; currencies are never mixed. */
export type CurrencySales = {
  currency: string;
  orders: number;
  tickets_sold: number;
  gross_ticket_sales: string;
  discounts: string;
  ticket_revenue: string;
  /** Null with a ticket type filter: fees belong to whole orders. */
  fees: string | null;
  gross_revenue: string;
  refund_count: number;
  refunds: string;
  net_revenue: string;
};

export type TicketTypeMetrics = {
  ticket_type_id: string;
  name: string;
  currency: string;
  is_hidden: boolean;
  capacity: number;
  sold_tickets: number;
  reserved_tickets: number;
  remaining_tickets: number;
  checked_in: number;
  period_tickets_sold: number;
  period_revenue: string;
};

export type CampaignMetrics = {
  campaign_id: string;
  name: string;
  promo_code: string | null;
  reserved_redemptions: number;
  successful_redemptions: number;
  sales: { currency: string; orders: number; tickets_sold: number; reversed_orders: number; discounts: string; revenue: string }[];
};

/** One day with sales, in the event timezone. `gross` is before discounts and fees. */
export type SalesPoint = { date: string; currency: string; orders: number; tickets: number; gross: string };

/** Capacity and attendance are current snapshots; sales follow the date range. */
export type EventAnalytics = {
  capacity: { total_capacity: number; sold_tickets: number; reserved_tickets: number; remaining_tickets: number };
  attendance: { checked_in: number; eligible_tickets: number; attendance_rate: number | null; cancelled_tickets: number; refunded_tickets: number };
  sales: CurrencySales[];
  sales_over_time: SalesPoint[];
  ticket_types: TicketTypeMetrics[];
  campaigns: CampaignMetrics[];
};

export type TimelineEntry = {
  id: number;
  timestamp: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor: { user_id: string | null; type: string; display_name: string | null };
  /** English sentence from the server, e.g. "Payment changed from PENDING to SUCCEEDED". */
  description: string;
};

/** Raw audit row; only used for the old and new values of a change. */
export type AuditEntry = {
  id: number;
  timestamp: string;
  actor_id: string | null;
  actor_type: "CUSTOMER" | "ORGANIZER" | "PLATFORM_ADMIN" | "USER" | "SYSTEM" | string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  event_id: string | null;
  metadata: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

// ---------- Support cases ----------

export type SupportStatus = "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED";
export type SupportCategory =
  | "TICKET_DELIVERY" | "PAYMENT" | "REFUND" | "SEATING" | "EVENT_INFORMATION" | "CHECK_IN" | "ACCOUNT" | "TECHNICAL";
export type SupportRelation = "REQUESTER" | "ORGANIZER" | "STAFF" | "PLATFORM_ADMIN";
export type SupportParticipant = { user_id: string; display_name: string };

export type SupportCaseCreate = {
  subject: string;
  category: SupportCategory;
  message: string;
  event_id?: string;
  order_id?: string;
  ticket_id?: string;
};

export type SupportCase = {
  id: string;
  case_type: "ATTENDEE_ORGANIZER" | "PLATFORM";
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  requester: SupportParticipant | null;
  assignee: SupportParticipant | null;
  event_id: string | null;
  event_title: string | null;
  order_id: string | null;
  order_number: number | null;
  ticket_id: string | null;
  is_escalated: boolean;
  escalation_reason: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  /** Only on a single case, not in lists. */
  access: { relation: SupportRelation; can_manage: boolean; can_escalate: boolean } | null;
};

export type SupportMessage = {
  id: string;
  sequence: number;
  sender: { user_id: string | null; display_name: string | null; role: SupportRelation | null };
  body: string;
  created_at: string;
};

export type SupportMessagePage = { items: SupportMessage[]; has_more: boolean; latest_sequence: number };
export type SupportAssignable = SupportParticipant & { role: SupportRelation };

// ---------- Platform administration ----------

export type AdminUser = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  global_role: string;
  status: string;
  is_organizer: boolean;
  organizer_display_name: string | null;
  organizer_verification_status: string | null;
  suspension_reason: string | null;
  created_at: string;
};

export type AdminEvent = {
  id: string;
  title: string;
  owner_email: string | null;
  organizer_display_name: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  starts_at: string;
  city: string | null;
  capacity: number | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  paid_sales_activated: boolean;
  paid_sales_suspended: boolean;
  created_at: string;
};

export type AdminEventAction = { event: AdminEvent; pending_orders: number; confirmed_orders: number };

export type AdminOrder = {
  id: string;
  order_number: number;
  event_id: string;
  event_title: string | null;
  buyer_email: string;
  status: OrderStatus;
  currency: string;
  subtotal_amount: string;
  discount_amount: string;
  fee_amount: string;
  total_amount: string;
  promo_code: string | null;
  paid_at: string | null;
  created_at: string;
};

export type AdminPayment = {
  id: string;
  order_id: string;
  order_number: number | null;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  is_simulated: boolean;
  failure_code: string | null;
  created_at: string;
};

export type AdminActivation = {
  event_id: string;
  event_title: string | null;
  organizer_display_name: string | null;
  organizer_verification_status: string | null;
  status: "NOT_ACTIVATED" | "ACTIVE" | "SUSPENDED";
  activation_fee_amount: string;
  activation_fee_paid_at: string | null;
  terms_accepted_at: string | null;
  activated_at: string | null;
  sales_suspension_reason: string | null;
};

export type AdminRefund = {
  id: string;
  order_id: string;
  order_number: number | null;
  event: { id: string; title: string } | null;
  amount: string;
  currency: string;
  status: string;
  kind: string;
  reason: string | null;
  is_simulated: boolean;
  created_at: string;
  completed_at: string | null;
};

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

/** Bookkeeping only: a dispute never moves money by itself. */
export type AdminDispute = {
  id: string;
  payment_id: string;
  order_id: string;
  event_id: string;
  support_case_id: string | null;
  status: DisputeStatus;
  reason: string;
  amount: string;
  currency: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type AdminEventReport = EventReport & {
  event: { id: string; title: string };
  event_is_suspended: boolean;
  /** Reports on the same event that are still open, this one included. */
  event_active_reports: number;
  reporter: { id: string; name: string } | null;
  reporter_email: string | null;
  resolution_note: string | null;
};

export type AdminCampaign = {
  id: string;
  event: { id: string; title: string } | null;
  name: string;
  code: string | null;
  effective_status: CampaignStatus;
  discount_type: DiscountType;
  discount_value: string;
  redemption_count: number;
  redemption_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type PlatformSettings = {
  activation_fee_amount: string;
  activation_fee_currency: string;
  processing_fee_percent: string;
  updated_at: string;
};

export type AdminFailure = {
  kind: "PAYMENT" | "REFUND" | "NOTIFICATION";
  id: string;
  order_id: string | null;
  code: string | null;
  message: string | null;
  attempts: number | null;
  occurred_at: string;
};

export type AdminAction = {
  id: number;
  timestamp: string;
  admin_display_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
};
