import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, TrendingUp } from "lucide-react";
import { TripStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types";

// ─── Destination → flag emoji lookup ─────────────────────────────────────────

const FLAG_MAP: [string, string][] = [
  ["olaszország", "🇮🇹"], ["italy",         "🇮🇹"], ["róma",   "🇮🇹"], ["velence", "🇮🇹"],
  ["franciaország","🇫🇷"], ["france",        "🇫🇷"], ["párizs", "🇫🇷"],
  ["spanyolország","🇪🇸"], ["spain",         "🇪🇸"], ["madrid", "🇪🇸"], ["barcelona","🇪🇸"],
  ["görögország",  "🇬🇷"], ["greece",        "🇬🇷"], ["athén",  "🇬🇷"], ["szantorini","🇬🇷"],
  ["horvátország", "🇭🇷"], ["croatia",       "🇭🇷"], ["dubrovnik","🇭🇷"],
  ["ausztria",     "🇦🇹"], ["austria",       "🇦🇹"], ["bécs",   "🇦🇹"],
  ["csehország",   "🇨🇿"], ["czech",         "🇨🇿"], ["prága",  "🇨🇿"],
  ["románia",      "🇷🇴"], ["romania",       "🇷🇴"], ["bukarest","🇷🇴"],
  ["németország",  "🇩🇪"], ["germany",       "🇩🇪"], ["berlin", "🇩🇪"],
  ["svájc",        "🇨🇭"], ["switzerland",   "🇨🇭"],
  ["törökország",  "🇹🇷"], ["turkey",        "🇹🇷"], ["isztambul","🇹🇷"],
  ["egyiptom",     "🇪🇬"], ["egypt",         "🇪🇬"], ["hurghada","🇪🇬"],
  ["dubai",        "🇦🇪"], ["abu dhabi",     "🇦🇪"], ["emirates","🇦🇪"],
  ["thaiföld",     "🇹🇭"], ["thailand",      "🇹🇭"], ["bangkok","🇹🇭"],
  ["japán",        "🇯🇵"], ["japan",         "🇯🇵"], ["tokió",  "🇯🇵"],
  ["portugália",   "🇵🇹"], ["portugal",      "🇵🇹"], ["lisszabon","🇵🇹"],
  ["hollandia",    "🇳🇱"], ["netherlands",   "🇳🇱"], ["amszterdam","🇳🇱"],
  ["lengyelország","🇵🇱"], ["poland",        "🇵🇱"], ["krakkó", "🇵🇱"],
  ["svédország",   "🇸🇪"], ["sweden",        "🇸🇪"],
  ["norvégia",     "🇳🇴"], ["norway",        "🇳🇴"],
  ["marokkó",      "🇲🇦"], ["morocco",       "🇲🇦"],
  ["tunézia",      "🇹🇳"], ["tunisia",       "🇹🇳"],
  ["bali",         "🇮🇩"], ["indonesia",     "🇮🇩"],
  ["new york",     "🇺🇸"], ["florida",       "🇺🇸"], ["usa",    "🇺🇸"],
  ["kanada",       "🇨🇦"], ["canada",        "🇨🇦"],
  ["ausztrália",   "🇦🇺"], ["australia",     "🇦🇺"],
];

function getDestinationFlag(destination: string): string {
  const lower = destination.toLowerCase();
  for (const [key, flag] of FLAG_MAP) {
    if (lower.includes(key)) return flag;
  }
  return "🌍";
}

// ─── Capacity bar ─────────────────────────────────────────────────────────────

function CapacityBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const barClass =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-green-500";
  const textClass =
    pct >= 100 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-zinc-700";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <Users className="h-3 w-3" />
          Kapacitás
        </span>
        <span className={cn("text-xs font-medium", textClass)}>
          {current} / {max} fő
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-100">
        <div
          className={cn("h-1.5 rounded-full transition-all", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── TripCard ─────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: Trip;
  onStatusChange?: (id: string) => void;
}

export function TripCard({ trip }: TripCardProps) {
  const flag = getDestinationFlag(trip.destination);

  return (
    <div className="flex flex-col rounded-md border border-zinc-200 bg-white hover:border-zinc-300 transition-colors">
      {/* Top section */}
      <div className="flex-1 p-5">
        {/* Status badge + code */}
        <div className="flex items-start justify-between mb-3">
          <TripStatusBadge status={trip.status} />
          <span className="font-mono text-[11px] text-zinc-400">{trip.trip_code}</span>
        </div>

        {/* Name */}
        <h3 className="font-semibold text-zinc-900 text-base leading-tight mb-1">
          {trip.name}
        </h3>

        {/* Destination */}
        <p className="text-sm text-zinc-600 mb-3">
          {flag} {trip.destination}
        </p>

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(trip.departure_date)} – {formatDate(trip.return_date)}
        </div>

        {/* Capacity */}
        <CapacityBar current={trip.current_bookings} max={trip.max_capacity} />

        {/* Revenue */}
        {trip.total_revenue > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            <span className="font-medium text-green-700">
              {formatCurrency(trip.total_revenue, "EUR")} bevétel
            </span>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center gap-2 border-t border-zinc-100 px-5 py-3">
        <Button asChild size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs h-8">
          <Link href={`/trips/${trip.id}`}>Részletek</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

export function TripCardSkeleton() {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 animate-pulse">
      <div className="h-4 w-16 bg-zinc-100 rounded mb-3" />
      <div className="h-5 w-3/4 bg-zinc-100 rounded mb-2" />
      <div className="h-4 w-1/2 bg-zinc-100 rounded mb-4" />
      <div className="h-3 w-2/3 bg-zinc-100 rounded mb-4" />
      <div className="h-1.5 w-full bg-zinc-100 rounded" />
    </div>
  );
}
