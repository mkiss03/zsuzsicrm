export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ClientSource = "messenger" | "website_form" | "referral" | "other";

export type TripStatus =
  | "planned"
  | "advertised"
  | "full"
  | "ongoing"
  | "completed"
  | "cancelled";

export type BookingStatus =
  | "interested"
  | "booked"
  | "deposit_paid"
  | "fully_paid"
  | "completed"
  | "cancelled";

export type PaymentType = "deposit" | "full_payment" | "partial" | "refund";

export type CostCategory =
  | "accommodation"
  | "flight"
  | "transfer"
  | "meals"
  | "tickets"
  | "other";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export type EmailTemplateType =
  | "confirmation"
  | "deposit_request"
  | "reminder"
  | "pre_trip"
  | "post_trip"
  | "promotional";

export type EmailLogStatus = "sent" | "failed" | "opened";

export type NotificationType =
  | "passport_expiry"
  | "payment_due"
  | "new_booking"
  | "trip_soon"
  | "low_capacity"
  | "payment_overdue";

export type ContractStatus = "pending" | "signed" | "expired" | "cancelled";

export type WorkflowStepStatus = "pending" | "done" | "skipped" | "blocked";

/** Ordered workflow steps — the source-of-truth order lives in WorkflowTab. */
export type WorkflowStepKey =
  | "inquiry_received"
  | "confirmation_sent"
  | "contract_send"
  | "contract_sign"
  | "deposit_request"
  | "deposit_paid"
  | "docs_verify"
  | "full_payment_request"
  | "full_paid"
  | "pre_trip_send"
  | "trip_started"
  | "trip_completed"
  | "followup_sent";

// ─── Database row types ───────────────────────────────────────────────────────

export interface Client {
  id: string;
  client_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_country: string;
  birth_date: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  source: ClientSource | null;
  is_vip: boolean;
  notes: string | null;
  trip_count: number;
  total_spent: number;
  discount_level: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Trip {
  id: string;
  trip_code: string;
  name: string;
  destination: string;
  departure_date: string;
  return_date: string;
  max_capacity: number;
  current_bookings: number;
  base_price: number;
  vip_price: number | null;
  description: string | null;
  status: TripStatus;
  total_revenue: number;
  total_costs: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Booking {
  id: string;
  booking_code: string;
  client_id: string;
  trip_id: string;
  status: BookingStatus;
  base_amount: number | null;
  discount_percentage: number;
  discount_amount: number;
  final_amount: number | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  fully_paid_at: string | null;
  payment_deadline: string | null;
  notes: string | null;
  source: ClientSource | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  type: PaymentType;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface TripCost {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  category: CostCategory | null;
  cost_date: string | null;
  created_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  booking_id: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  service_date: string | null;
  items: InvoiceItem[];
  subtotal: number | null;
  tax_rate: number;
  tax_amount: number | null;
  total: number | null;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[] | null;
  type: EmailTemplateType | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  client_id: string | null;
  template_id: string | null;
  booking_id: string | null;
  subject: string;
  body: string;
  sent_at: string;
  status: EmailLogStatus | null;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string | null;
  updated_at: string;
}

export interface BookingContract {
  id: string;
  booking_id: string;
  token: string;
  document_type: string;
  document_title: string;
  document_body: string;
  status: ContractStatus;
  signed_name: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signed_ua: string | null;
  signature_data: string | null;
  expires_at: string;
  sent_at: string | null;
  email_sent_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  booking_id: string;
  step_key: WorkflowStepKey;
  status: WorkflowStepStatus;
  done_at: string | null;
  triggered_by: string | null;
  notes: string | null;
  related_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Joined / enriched types ─────────────────────────────────────────────────

export type BookingWithRelations = Booking & {
  client: Client;
  trip: Trip;
  payments?: Payment[];
};

export type TripWithStats = Trip & {
  profit: number;
  occupancy_rate: number;
};

// ─── API response shapes ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: string;
}
