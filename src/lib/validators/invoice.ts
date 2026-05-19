import { z } from "zod";

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Kötelező mező"),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
});

export const invoiceSchema = z.object({
  client_id: z.string().uuid("Válassz ügyfelet"),
  booking_id: z.string().uuid().optional().nullable(),
  status: z
    .enum(["draft", "sent", "paid", "overdue", "cancelled"])
    .default("draft"),
  issue_date: z.string().default(new Date().toISOString().slice(0, 10)),
  due_date: z.string().optional().nullable(),
  service_date: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "Legalább egy tétel szükséges"),
  tax_rate: z.coerce.number().min(0).max(100).default(13),
  notes: z.string().optional(),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;
