import { z } from "zod";

export const participantSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Név megadása kötelező"),
  is_lead: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  unit_price: z.coerce.number().min(0).optional().nullable(),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
  discount_amount: z.coerce.number().min(0).default(0),
  final_price: z.coerce.number().min(0).optional().nullable(),
});

export type ParticipantFormValues = z.infer<typeof participantSchema>;

export const bookingSchema = z.object({
  client_id: z.string().uuid("Válassz ügyfelet"),
  trip_id: z.string().uuid("Válassz utat"),
  status: z
    .enum([
      "interested",
      "booked",
      "deposit_paid",
      "fully_paid",
      "completed",
      "cancelled",
    ])
    .default("interested"),
  party_size: z.coerce.number().min(1).default(1),
  base_amount: z.coerce.number().min(0).optional().nullable(),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
  discount_amount: z.coerce.number().min(0).default(0),
  final_amount: z.coerce.number().min(0).optional().nullable(),
  deposit_amount: z.coerce.number().min(0).optional().nullable(),
  payment_deadline: z.string().optional().nullable(),
  notes: z.string().optional(),
  source: z
    .enum(["messenger", "website_form", "referral", "other"])
    .optional()
    .nullable(),
  participants: z.array(participantSchema).optional(),
});

export type BookingFormValues = z.infer<typeof bookingSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Az összeg pozitív kell legyen"),
  type: z.enum(["deposit", "full_payment", "partial", "refund"]),
  payment_date: z.string().default(new Date().toISOString()),
  account: z.enum(["huf_account", "eur_account", "revolut"]).optional(),
  currency: z.enum(["HUF", "EUR"]).default("HUF"),
  notes: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
