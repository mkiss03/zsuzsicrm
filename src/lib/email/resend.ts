import { Resend } from "resend";
import { interpolateTemplate } from "@/lib/utils";
import type { EmailTemplate, Client, Booking, Trip } from "@/types";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@zsuzsitravel.hu";

interface SendEmailOptions {
  to: string;
  template: EmailTemplate;
  variables: Record<string, string>;
}

export async function sendTemplatedEmail({ to, template, variables }: SendEmailOptions) {
  const subject = interpolateTemplate(template.subject, variables);
  const body = interpolateTemplate(template.body, variables);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, "<br>"),
  });

  if (error) throw new Error(error.message);
  return { id: data?.id, subject, body };
}

export function buildBookingVariables(
  client: Client,
  booking: Booking,
  trip: Trip,
  agencyName = "ZsuzsiTravel"
): Record<string, string> {
  return {
    client_name: `${client.last_name} ${client.first_name}`,
    trip_name: trip.name,
    departure_date: trip.departure_date,
    return_date: trip.return_date,
    booking_code: booking.booking_code,
    final_amount: booking.final_amount?.toLocaleString("hu-HU") ?? "—",
    deposit_amount: booking.deposit_amount?.toLocaleString("hu-HU") ?? "—",
    payment_deadline: booking.payment_deadline ?? "—",
    remaining_amount: booking.final_amount != null && booking.deposit_amount != null
      ? (booking.final_amount - booking.deposit_amount).toLocaleString("hu-HU")
      : "—",
    agency_name: agencyName,
  };
}
