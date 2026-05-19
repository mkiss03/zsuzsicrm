"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserPlus,
  Mail,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Check,
  X as XIcon,
  ChevronDown,
  Loader2,
  Users,
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

import { createClient } from "@/lib/supabase/client";
import { useTrips, type Participant } from "@/hooks/useTrips";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookingStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types";

// ─── Booking status options ───────────────────────────────────────────────────

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: "interested",   label: "Érdeklődő" },
  { value: "booked",       label: "Foglalt" },
  { value: "deposit_paid", label: "Előleg fizetve" },
  { value: "fully_paid",   label: "Kifizetve" },
  { value: "completed",    label: "Teljesített" },
  { value: "cancelled",    label: "Lemondva" },
];

// ─── Payment deadline cell ────────────────────────────────────────────────────

function DeadlineCell({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-zinc-400">—</span>;
  const days = differenceInDays(parseISO(deadline), new Date());
  return (
    <span className={cn("text-sm", days < 0 ? "text-red-600 font-medium" : "text-zinc-700")}>
      {formatDate(deadline)}
      {days < 0 && <span className="ml-1 text-xs">({Math.abs(days)} napja lejárt)</span>}
    </span>
  );
}

// ─── Inline status editor ─────────────────────────────────────────────────────

function StatusCell({
  bookingId,
  status,
  onChanged,
}: {
  bookingId: string;
  status: BookingStatus;
  onChanged: (id: string, status: BookingStatus) => void;
}) {
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);

  async function handleChange(newStatus: BookingStatus) {
    setUpdating(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", bookingId);
    setUpdating(false);
    if (error) {
      toast.error("Hiba a státusz módosításakor");
    } else {
      onChanged(bookingId, newStatus);
      toast.success("Státusz frissítve");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 rounded"
          disabled={updating}
        >
          {updating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <BookingStatusBadge status={status} />
          )}
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={opt.value === status ? "font-medium" : ""}
          >
            {opt.value === status && <Check className="mr-2 h-3 w-3" />}
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── ParticipantsTable ────────────────────────────────────────────────────────

interface ParticipantsTableProps {
  tripId: string;
}

export function ParticipantsTable({ tripId }: ParticipantsTableProps) {
  const router = useRouter();
  const supabase = createClient();
  const { getTripParticipants } = useTrips();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<BookingStatus | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    const data = await getTripParticipants(tripId);
    setParticipants(data ?? []);
    setLoading(false);
  }, [tripId]);

  useEffect(() => { void fetchParticipants(); }, [fetchParticipants]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const allSelected = participants.length > 0 && selectedIds.size === participants.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(participants.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Inline status change callback ──────────────────────────────────────────

  function handleStatusChanged(bookingId: string, newStatus: BookingStatus) {
    setParticipants((prev) =>
      prev.map((p) => (p.id === bookingId ? { ...p, status: newStatus } : p))
    );
  }

  // ── Bulk status change ─────────────────────────────────────────────────────

  async function handleBulkStatusChange(newStatus: BookingStatus) {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in("id", ids);
    setBulkLoading(false);

    if (error) {
      toast.error("Hiba a tömeges módosításkor");
    } else {
      setParticipants((prev) =>
        prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: newStatus } : p))
      );
      setSelectedIds(new Set());
      setBulkStatus("");
      toast.success(`${ids.length} foglalás státusza frissítve`);
    }
  }

  // ── Bulk email ─────────────────────────────────────────────────────────────

  function handleBulkEmail() {
    const clientIds = participants
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.client.id)
      .join(",");
    router.push(`/emails?clients=${clientIds}`);
  }

  // ── Summary row totals ─────────────────────────────────────────────────────

  const totals = participants.reduce(
    (acc, p) => ({
      baseAmount: acc.baseAmount + (p.base_amount ?? 0),
      discountAmount: acc.discountAmount + (p.discount_amount ?? 0),
      finalAmount: acc.finalAmount + (p.final_amount ?? 0),
      depositPaid: acc.depositPaid + (p.deposit_paid_at ? 1 : 0),
      fullyPaid: acc.fullyPaid + (p.fully_paid_at ? 1 : 0),
    }),
    { baseAmount: 0, discountAmount: 0, finalAmount: 0, depositPaid: 0, fullyPaid: 0 }
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">
          {participants.length} résztvevő
        </span>
        <Button
          asChild
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Link href={`/bookings/new?trip=${tripId}`}>
            <UserPlus className="mr-2 h-4 w-4" />
            Résztvevő hozzáadása
          </Link>
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} kiválasztva
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkEmail}
              className="h-7 text-xs"
            >
              <Mail className="mr-1 h-3.5 w-3.5" />
              Email küldés
            </Button>
            <Select
              value={bulkStatus}
              onValueChange={(v) => {
                setBulkStatus(v as BookingStatus);
                void handleBulkStatusChange(v as BookingStatus);
              }}
            >
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="Státusz változt…" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
            <button
              className="ml-1 text-xs text-blue-600 hover:underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Visszavon
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {participants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nincs résztvevő"
          description="Adj hozzá foglalást az úthoz a 'Résztvevő hozzáadása' gombbal."
          action={
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/bookings/new?trip=${tripId}`}>
                <UserPlus className="mr-2 h-4 w-4" />
                Résztvevő hozzáadása
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border border-zinc-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
                    aria-label="Összes kijelölése"
                  />
                </th>
                <th className="px-4 py-3 text-left">Ügyfél</th>
                <th className="px-4 py-3 text-left">Kód</th>
                <th className="px-4 py-3 text-left">Státusz</th>
                <th className="px-4 py-3 text-right">Alap ár</th>
                <th className="px-4 py-3 text-right">Kedv.</th>
                <th className="px-4 py-3 text-right">Végösszeg</th>
                <th className="px-4 py-3 text-center">Előleg</th>
                <th className="px-4 py-3 text-center">Kifizetve</th>
                <th className="px-4 py-3 text-left">Határidő</th>
                <th className="px-4 py-3 text-right w-12"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {participants.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "hover:bg-zinc-50 transition-colors",
                    selectedIds.has(p.id) && "bg-blue-50/40"
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/clients/${p.client.id}`}
                        className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                      >
                        {p.client.last_name} {p.client.first_name}
                      </Link>
                      {p.client.is_vip && (
                        <Badge variant="warning" className="text-[10px] px-1">VIP</Badge>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400">{p.client.email}</div>
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {p.booking_code}
                  </td>

                  <td className="px-4 py-3">
                    <StatusCell
                      bookingId={p.id}
                      status={p.status}
                      onChanged={handleStatusChanged}
                    />
                  </td>

                  <td className="px-4 py-3 text-right text-zinc-700">
                    {formatCurrency(p.base_amount)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {p.discount_percentage > 0 ? (
                      <span className="text-amber-600 text-xs font-medium">
                        -{p.discount_percentage}%
                        <span className="block text-zinc-400 font-normal">
                          {formatCurrency(p.discount_amount)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {formatCurrency(p.final_amount)}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {p.deposit_paid_at ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <XIcon className="h-4 w-4 text-zinc-300 mx-auto" />
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {p.fully_paid_at ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <XIcon className="h-4 w-4 text-zinc-300 mx-auto" />
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <DeadlineCell deadline={p.payment_deadline} />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Műveletek</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/emails?client=${p.client.id}&booking=${p.id}`)
                          }
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Email küldés
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/invoices/new?booking=${p.id}`)
                          }
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Számla
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/clients/${p.client.id}`)}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Megjegyzés
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Summary row */}
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
              <tr>
                <td colSpan={4} className="px-4 py-3">
                  Összesítő ({participants.length} fő)
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.baseAmount)}</td>
                <td className="px-4 py-3 text-right text-amber-600">
                  {totals.discountAmount > 0 ? `-${formatCurrency(totals.discountAmount)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">
                  {formatCurrency(totals.finalAmount)}
                </td>
                <td className="px-4 py-3 text-center">
                  {totals.depositPaid}/{participants.length}
                </td>
                <td className="px-4 py-3 text-center">
                  {totals.fullyPaid}/{participants.length}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
