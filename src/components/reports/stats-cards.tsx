import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Map, BookOpen } from "lucide-react";

interface Props {
  clientCount: number;
  activeTrips: number;
  pendingBookings: number;
}

export function StatsCards({ clientCount, activeTrips, pendingBookings }: Props) {
  const cards = [
    { title: "Ügyfelek",        value: clientCount,      icon: Users,    color: "text-blue-600" },
    { title: "Aktív utak",      value: activeTrips,      icon: Map,      color: "text-green-600" },
    { title: "Nyitott foglalások", value: pendingBookings, icon: BookOpen, color: "text-amber-600" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ title, value, icon: Icon, color }) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{value.toLocaleString("hu-HU")}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
