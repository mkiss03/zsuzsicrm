import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  WorkflowPipelineView,
  type BookingPipelineRow,
  type TripOption,
} from "./WorkflowPipelineView";

export const metadata = { title: "Workflow | ZsuzsiCRM" };

export default async function WorkflowPage() {
  const supabase = createClient();

  const [{ data }, { data: tripsData }] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, booking_code, status, final_amount, created_at, trip_id,
        client:clients(first_name, last_name, email),
        trip:trips(id, name, departure_date, return_date),
        workflow_steps(step_key, status, done_at, triggered_by)
      `)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false }),
    supabase
      .from("trips")
      .select("id, name")
      .not("status", "eq", "cancelled")
      .order("name"),
  ]);

  const rows: BookingPipelineRow[] = (data ?? []).map((b) => {
    const client = b.client as unknown as { first_name: string; last_name: string; email: string | null } | null;
    const trip   = b.trip   as unknown as { id: string; name: string; departure_date: string; return_date: string } | null;
    return {
      id:             b.id,
      booking_code:   b.booking_code,
      status:         b.status as BookingPipelineRow["status"],
      final_amount:   b.final_amount,
      created_at:     b.created_at,
      departure_date: trip?.departure_date ?? null,
      return_date:    trip?.return_date    ?? null,
      client_name:    client ? `${client.last_name} ${client.first_name}` : "—",
      client_email:   client?.email ?? null,
      trip_name:      trip?.name ?? "—",
      trip_id:        trip?.id ?? (b.trip_id as string),
      workflow_steps: (b.workflow_steps as BookingPipelineRow["workflow_steps"]) ?? [],
    };
  });

  const trips: TripOption[] = (tripsData ?? []) as TripOption[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Workflow Center"
        subtitle="Foglalások interaktív folyamatkezelője — szűrj, intézz mindent egy helyen"
      />
      <WorkflowPipelineView initialBookings={rows} trips={trips} />
    </div>
  );
}
