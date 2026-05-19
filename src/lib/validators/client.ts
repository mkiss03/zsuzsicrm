import { z } from "zod";

export const clientSchema = z.object({
  first_name: z.string().min(1, "Kötelező mező"),
  last_name: z.string().min(1, "Kötelező mező"),
  email: z.string().email("Érvénytelen email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_zip: z.string().optional(),
  address_country: z.string().default("Magyarország"),
  birth_date: z.string().optional(),
  nationality: z.string().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.string().optional(),
  source: z
    .enum(["messenger", "website_form", "referral", "other"])
    .optional(),
  is_vip: z.boolean().default(false),
  notes: z.string().optional(),
  discount_level: z.coerce.number().int().min(0).max(3).default(0),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
