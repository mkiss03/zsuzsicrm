import { type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-zinc-100">
        <Icon size={40} stroke={1} className="text-zinc-300" />
      </div>
      <p className="text-sm font-medium text-zinc-600">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] text-zinc-400 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
