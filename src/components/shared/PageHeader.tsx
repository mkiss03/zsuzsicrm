import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between border-b border-zinc-200 pb-6 mb-6",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-zinc-900 truncate">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="ml-4 flex flex-shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
