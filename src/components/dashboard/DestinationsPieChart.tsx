"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { DestinationStat } from "@/hooks/useReports";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"] as const;

interface Props {
  data: DestinationStat[];
  totalBookings: number;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload as DestinationStat;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-zinc-900">{d.destination}</p>
      <p className="text-zinc-600 mt-0.5">{d.count} foglalás · {d.percentage}%</p>
    </div>
  );
}

export function DestinationsPieChart({ data, totalBookings }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-zinc-400">
        Nincs adat
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={80}
              dataKey="count"
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-zinc-900">{totalBookings}</span>
          <span className="text-[10px] text-zinc-400">foglalás</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 space-y-1.5 px-1">
        {data.map((d, i) => (
          <div key={d.destination} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 text-xs text-zinc-700 truncate" title={d.destination}>
              {d.destination}
            </span>
            <span className="text-xs font-medium text-zinc-500">{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
