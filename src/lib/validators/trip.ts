import { z } from "zod";

export const tripSchema = z
  .object({
    name: z.string().min(1, "Kötelező mező"),
    destination: z.string().min(1, "Kötelező mező"),
    departure_date: z.string().min(1, "Kötelező mező"),
    return_date: z.string().min(1, "Kötelező mező"),
    max_capacity: z.coerce.number().int().min(1, "Legalább 1 fő"),
    base_price: z.coerce.number().min(0, "Nem lehet negatív"),
    vip_price: z.coerce.number().min(0).optional().nullable(),
    description: z.string().optional(),
    meeting_point: z.string().optional(),
    departure_time: z.string().optional(),
    status: z
      .enum(["planned", "advertised", "full", "ongoing", "completed", "cancelled"])
      .default("planned"),
  })
  .refine((data) => data.return_date >= data.departure_date, {
    message: "A visszaérkezés nem lehet korábbi az indulásánál",
    path: ["return_date"],
  });

export type TripFormValues = z.infer<typeof tripSchema>;
