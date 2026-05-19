"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { formatDateRelative } from "@/lib/utils";
import type { Notification } from "@/types";
import { toast } from "sonner";

interface Props {
  notifications: Notification[];
}

export function NotificationList({ notifications: initial }: Props) {
  const [items, setItems] = useState(initial);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems([]);
    toast.success("Összes értesítés olvasottként jelölve");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4" />
          Értesítések
          {items.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              {items.length}
            </span>
          )}
        </CardTitle>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 px-2 text-xs">
            <CheckCheck className="mr-1 h-3 w-3" />
            Mind olvasott
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nincs olvasatlan értesítés
          </p>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{n.title}</p>
              <p className="text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateRelative(n.created_at)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
