import { type ElementType } from "react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ElementType;
  trend?: {
    value: number;
    label?: string;
  };
  borderColor?: string;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  borderColor = "border-l-zinc-300",
  iconBgColor = "bg-zinc-100",
  iconColor   = "text-zinc-500",
  className,
}: StatsCardProps) {
  const trendUp = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        "card-hover rounded-md border border-zinc-200 bg-white p-5 border-l-4",
        borderColor,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-zinc-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-[22px] font-semibold text-zinc-900 tabular-nums leading-none count-up">
            {typeof value === "number" ? value.toLocaleString("hu-HU") : value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-[13px] text-zinc-400 leading-snug">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md",
          iconBgColor
        )}>
          <Icon size={22} stroke={1.5} className={iconColor} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3.5 flex items-center gap-1.5">
          <span className={cn(
            "flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
            trendUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          )}>
            {trendUp
              ? <IconTrendingUp size={11} stroke={2} />
              : <IconTrendingDown size={11} stroke={2} />}
            {trendUp ? "+" : ""}{trend.value.toFixed(1)}%
          </span>
          {trend.label && (
            <span className="text-[12px] text-zinc-400">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
