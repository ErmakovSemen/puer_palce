import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { CeremonyBooking } from "@shared/schema";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  done: "Пришли",
  cancelled: "Отменена",
};

const STATUS_FLOW = ["new", "confirmed", "done", "cancelled"] as const;

const VARIANT_LABELS: Record<string, string> = {
  ceremony: "Церемония",
  tea: "Чай",
  gift: "Подарок",
};

function formatUtm(raw: string | null) {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const parts = Object.entries(parsed).map(([key, value]) => `${key.replace("utm_", "")}: ${value}`);
    return parts.length > 0 ? parts.join(", ") : "—";
  } catch {
    return raw;
  }
}

/** Заявки с моно-лендинга: список и смена статуса. */
export default function AdminCeremonyBookings({ adminFetch, enabled }: { adminFetch: AdminFetch; enabled: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery<CeremonyBooking[]>({
    queryKey: ["/api/admin/ceremony-bookings"],
    queryFn: () => adminFetch("/api/admin/ceremony-bookings"),
    enabled,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminFetch(`/api/admin/ceremony-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ceremony-bookings"] });
      toast({ title: "Статус обновлён" });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось обновить", description: error.message, variant: "destructive" });
    },
  });

  const newCount = bookings.filter((booking) => booking.status === "new").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold">Заявки с лендинга</h2>
        <span className="text-sm text-muted-foreground">
          {bookings.length} всего{newCount > 0 ? `, ${newCount} новых` : ""}
        </span>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Загружаем заявки…</p>
        </Card>
      ) : bookings.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Заявок пока нет</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Создана</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Имя</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Телефон</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Когда</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Гостей</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Лендинг</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Метки</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Статус</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b last:border-0 align-top">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{booking.createdAt}</td>
                    <td className="p-3">
                      <div className="font-medium">{booking.name}</div>
                      {booking.telegram && <div className="text-muted-foreground">{booking.telegram}</div>}
                      {booking.comment && <div className="mt-1 max-w-xs text-muted-foreground">{booking.comment}</div>}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <a href={`tel:${booking.phone}`} className="hover:underline">
                        {booking.phone}
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {[booking.preferredDate, booking.preferredTime].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="p-3">{booking.guests}</td>
                    <td className="p-3 whitespace-nowrap">{VARIANT_LABELS[booking.variant] ?? booking.variant}</td>
                    <td className="p-3 max-w-[14rem] text-muted-foreground">{formatUtm(booking.utm)}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <Badge variant={booking.status === "new" ? "default" : "secondary"}>
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </Badge>
                        <div className="flex flex-wrap gap-1">
                          {STATUS_FLOW.filter((status) => status !== booking.status).map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: booking.id, status })}
                            >
                              {STATUS_LABELS[status]}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
