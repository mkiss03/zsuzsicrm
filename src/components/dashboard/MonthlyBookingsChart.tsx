"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

export interface MonthlyBookingRow {
  monthLabel: string;
  count: number;
}

type Period = "3H" | "6H" | "1É";

const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "3H", label: "3H", months:  3 },
  { key: "6H", label: "6H", months:  6 },
  { key: "1É", label: "1É", months: 12 },
];

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-zinc-900 mb-1">{label}</p>
      <p className="text-violet-600 font-medium">{payload[0]!.value} foglalás</p>
    </div>
  );
}

export function MonthlyBookingsChart({ data }: { data: MonthlyBookingRow[] }) {
  const [period, setPeriod] = useState<Period>("1É");
  const months = PERIODS.find((p) => p.key === period)?.months ?? 12;
  const sliced = data.slice(-months);

  return (
    <div>
      <div className="flex items-center justify-end mb-4 gap-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded transition-colors",
              period === p.key
                ? "bg-violet-600 text-white"
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
            allowDecimals={false}
            width={24}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5" }} />
          <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
