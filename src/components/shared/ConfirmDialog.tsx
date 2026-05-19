"use client";

import { useState } from "react";
import { IconLoader2, IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Megerősítés",
  cancelLabel  = "Mégse",
  variant      = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  }

  const Icon = variant === "danger" ? IconAlertTriangle : IconInfoCircle;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel(); }}>
      <DialogContent className="animate-scale-in sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md",
              variant === "danger" ? "bg-red-50" : "bg-blue-50"
            )}>
              <Icon
                size={18}
                stroke={1.5}
                className={variant === "danger" ? "text-red-600" : "text-blue-600"}
              />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-zinc-900">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1 text-[13px] text-zinc-500 leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="btn-interactive text-[14px]"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "btn-interactive text-[14px]",
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {loading && (
              <IconLoader2 size={14} stroke={2} className="mr-2 animate-spin-slow" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
