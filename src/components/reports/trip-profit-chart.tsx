"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Trip } from "@/types";

interface Props {
  trips: Pick<Trip, "name" | "departure_date" | "total_revenue" | "total_costs">[];
}

export function TripProfitChart({ trips }: Props) {
  const data = trips
    .slice()
    .reverse()
    .map((t) => ({
      name: t.name.length > 14 ? t.name.slice(0, 14) + "…" : t.name,
      Profit: t.total_revenue - t.total_costs,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profit utak szerint (HUF)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => v.toLocaleString("hu-HU") + " Ft"} />
            <Area
              type="monotone"
              dataKey="Profit"
              stroke="#22c55e"
              fill="#dcfce7"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
