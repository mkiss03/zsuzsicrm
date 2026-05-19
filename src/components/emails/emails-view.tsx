"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateRelative } from "@/lib/utils";
import type { EmailTemplate, EmailLog } from "@/types";

const typeLabels: Record<string, string> = {
  confirmation:    "Visszaigazolás",
  deposit_request: "Előleg bekérő",
  reminder:        "Emlékeztető",
  pre_trip:        "Út előtti",
  post_trip:       "Út utáni",
  promotional:     "Promóció",
};

interface Props {
  templates: EmailTemplate[];
  logs: (EmailLog & { client: { first_name: string; last_name: string } | null })[];
}

export function EmailsView({ templates, logs }: Props) {
  const [tab, setTab] = useState<"templates" | "logs">("templates");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["templates", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t === "templates" ? "Sablonok" : "Kiküldési előzmények"}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{tmpl.name}</CardTitle>
                  {tmpl.type && (
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[tmpl.type] ?? tmpl.type}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">{tmpl.subject}</p>
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{tmpl.body}</p>
                {tmpl.variables && tmpl.variables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tmpl.variables.map((v) => (
                      <span key={v} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <Card>
          <CardContent className="divide-y p-0">
            {logs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nincs kiküldési előzmény
              </p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{log.subject}</p>
                  {log.client && (
                    <p className="text-xs text-muted-foreground">
                      {log.client.last_name} {log.client.first_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateRelative(log.sent_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    log.status === "sent"
                      ? "success"
                      : log.status === "opened"
                      ? "info"
                      : "destructive"
                  }
                >
                  {log.status === "sent" ? "Elküldve" : log.status === "opened" ? "Megnyitva" : "Sikertelen"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
