"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";
import type { MonthlyRevenueRow } from "@/hooks/useReports";

interface Props {
  data: MonthlyRevenueRow[];
}

type Period = "3H" | "6H" | "1É";

const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "3H", label: "3H", months:  3 },
  { key: "6H", label: "6H", months:  6 },
  { key: "1É", label: "1É", months: 12 },
];

function fmtEur(n: number): string {
  if (n === 0) return "€ 0";
  if (Math.abs(n) >= 1000) return `€ ${(n / 1000).toFixed(1)}k`;
  return `€ ${Math.round(n)}`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload as MonthlyRevenueRow;
  return (
    <div className="rounded border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-zinc-900 mb-1">{label}</p>
      <p className="text-blue-600 font-medium">
        € {d.revenue.toLocaleString("de-AT", { minimumFractionDigits: 0 })}
      </p>
      {d.bookingCount > 0 && (
        <p className="text-zinc-400 mt-0.5">{d.bookingCount} foglalás</p>
      )}
    </div>
  );
}

export function MonthlyRevenueChart({ data }: Props) {
  const [period, setPeriod] = useState<Period>("1É");
  const months = PERIODS.find((p) => p.key === period)?.months ?? 12;
  const sliced = data.slice(-months);

  return (
    <div>
      {/* Period toggle */}
      <div className="flex items-center justify-end mb-4 gap-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded transition-colors",
              period === p.key
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sliced} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f4f4f5" />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtEur}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
