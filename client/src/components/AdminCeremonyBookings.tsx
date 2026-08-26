import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import { Plus, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;
type CalendarSource = "event" | "booking";

interface CalendarItem {
  id: string;
  source: CalendarSource;
  sourceId: number;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  eventType: string;
  status: string;
  editable: boolean;
  booking?: {
    id: number;
    name: string;
    phone: string;
    telegram: string | null;
    guests: number;
    status: string;
    comment: string | null;
  };
}

interface DraftEvent {
  id?: number;
  source?: CalendarSource;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  eventType: "event" | "ceremony" | "private";
  status: "draft" | "published" | "cancelled";
}

const EMPTY_DRAFT: DraftEvent = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  eventType: "event",
  status: "published",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  event: "Мероприятие",
  ceremony: "Церемония",
  private: "Закрыто",
  booking: "Бронь",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  done: "Пришли",
  cancelled: "Отменена",
  draft: "Черновик",
  published: "Опубликовано",
};

function toDateTimeLocal(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function plusHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function defaultDraft(startAt?: string, endAt?: string): DraftEvent {
  const start = startAt || new Date().toISOString();
  return {
    ...EMPTY_DRAFT,
    startAt: start,
    endAt: endAt || plusHours(start, 2),
  };
}

function eventColors(item: CalendarItem) {
  if (item.source === "booking") {
    return item.status === "cancelled"
      ? { backgroundColor: "#94a3b8", borderColor: "#64748b" }
      : { backgroundColor: "#7a3b22", borderColor: "#7a3b22" };
  }

  if (item.status === "cancelled") return { backgroundColor: "#94a3b8", borderColor: "#64748b" };
  if (item.status === "draft") return { backgroundColor: "#c08a3e", borderColor: "#a86f24" };
  if (item.eventType === "private") return { backgroundColor: "#334155", borderColor: "#334155" };
  if (item.eventType === "ceremony") return { backgroundColor: "#4e7c63", borderColor: "#4e7c63" };
  return { backgroundColor: "#2563eb", borderColor: "#2563eb" };
}

function itemToEvent(item: CalendarItem): EventInput {
  return {
    id: item.id,
    title: item.title,
    start: item.startAt,
    end: item.endAt,
    editable: item.editable,
    extendedProps: item,
    ...eventColors(item),
  };
}

function CalendarEditor({
  draft,
  saving,
  onChange,
  onSave,
  onDelete,
  onCancel,
}: {
  draft: DraftEvent;
  saving: boolean;
  onChange: (draft: DraftEvent) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-semibold">{draft.id ? "Редактировать событие" : "Новое событие"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Клик по слоту создаёт событие, drag/resize меняет время.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Закрыть
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Название
          <input
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Например: дегустация шэнов"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Начало
            <input
              type="datetime-local"
              value={toDateTimeLocal(draft.startAt)}
              onChange={(event) => onChange({ ...draft, startAt: fromDateTimeLocal(event.target.value) })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Конец
            <input
              type="datetime-local"
              value={toDateTimeLocal(draft.endAt)}
              onChange={(event) => onChange({ ...draft, endAt: fromDateTimeLocal(event.target.value) })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Тип
            <select
              value={draft.eventType}
              onChange={(event) => onChange({ ...draft, eventType: event.target.value as DraftEvent["eventType"] })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="event">Мероприятие</option>
              <option value="ceremony">Церемония</option>
              <option value="private">Закрыто</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Статус
            <select
              value={draft.status}
              onChange={(event) => onChange({ ...draft, status: event.target.value as DraftEvent["status"] })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="published">Опубликовано</option>
              <option value="draft">Черновик</option>
              <option value="cancelled">Отменено</option>
            </select>
          </label>
        </div>

        <label className="text-xs font-medium text-muted-foreground">
          Описание
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Короткое описание для команды"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={onSave}>
            <Save className="mr-2 h-4 w-4" />
            Сохранить
          </Button>
          {onDelete && (
            <Button disabled={saving} variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AdminCeremonyBookings({ adminFetch, enabled }: { adminFetch: AdminFetch; enabled: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);

  const { data: items = [], isLoading } = useQuery<CalendarItem[]>({
    queryKey: ["/api/admin/calendar-items"],
    queryFn: () => adminFetch("/api/admin/calendar-items"),
    enabled,
  });

  const events = useMemo(() => items.map(itemToEvent), [items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/calendar-items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/ceremony-bookings"] });
  };

  const saveEvent = useMutation({
    mutationFn: (eventDraft: DraftEvent) => {
      const payload = {
        title: eventDraft.title.trim(),
        description: eventDraft.description.trim() || null,
        startAt: eventDraft.startAt,
        endAt: eventDraft.endAt,
        eventType: eventDraft.eventType,
        status: eventDraft.status,
      };

      return eventDraft.id
        ? adminFetch(`/api/admin/calendar-events/${eventDraft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : adminFetch("/api/admin/calendar-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      invalidate();
      setDraft(null);
      toast({ title: "Событие сохранено" });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/calendar-events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setDraft(null);
      toast({ title: "Событие удалено" });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось удалить", description: error.message, variant: "destructive" });
    },
  });

  const moveItem = useMutation({
    mutationFn: ({ item, startAt, endAt }: { item: CalendarItem; startAt: string; endAt: string }) => {
      if (item.source === "booking") {
        return adminFetch(`/api/admin/calendar-bookings/${item.sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startAt, endAt }),
        });
      }

      return adminFetch(`/api/admin/calendar-events/${item.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt, endAt }),
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Расписание обновлено" });
    },
    onError: (error: Error) => {
      invalidate();
      toast({ title: "Не удалось перенести", description: error.message, variant: "destructive" });
    },
  });

  const bookingCount = items.filter((item) => item.source === "booking").length;
  const eventCount = items.filter((item) => item.source === "event").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold sm:text-2xl">Расписание</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {eventCount} мероприятий, {bookingCount} броней
          </p>
        </div>
        <Button onClick={() => { setSelectedItem(null); setDraft(defaultDraft()); }}>
          <Plus className="mr-2 h-4 w-4" />
          Событие
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card className="overflow-hidden p-3">
          {isLoading ? (
            <div className="flex min-h-[38rem] items-center justify-center text-sm text-muted-foreground">
              Загружаем расписание...
            </div>
          ) : (
            <div className="admin-calendar">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                locale="ru"
                firstDay={1}
                allDaySlot={false}
                slotMinTime="10:00:00"
                slotMaxTime="23:00:00"
                slotDuration="00:30:00"
                height="auto"
                editable
                selectable
                selectMirror
                nowIndicator
                events={events}
                select={(selection) => {
                  setSelectedItem(null);
                  setDraft(defaultDraft(selection.start.toISOString(), selection.end.toISOString()));
                }}
                dateClick={(info) => {
                  setSelectedItem(null);
                  setDraft(defaultDraft(info.date.toISOString()));
                }}
                eventClick={(info) => {
                  const item = info.event.extendedProps as CalendarItem;
                  setSelectedItem(item);
                  if (item.source === "event") {
                    setDraft({
                      id: item.sourceId,
                      source: "event",
                      title: item.title,
                      description: item.description ?? "",
                      startAt: item.startAt,
                      endAt: item.endAt,
                      eventType: item.eventType as DraftEvent["eventType"],
                      status: item.status as DraftEvent["status"],
                    });
                  } else {
                    setDraft(null);
                  }
                }}
                eventDrop={(info) => {
                  const item = info.event.extendedProps as CalendarItem;
                  moveItem.mutate({
                    item,
                    startAt: info.event.start?.toISOString() ?? item.startAt,
                    endAt: info.event.end?.toISOString() ?? plusHours(info.event.start?.toISOString() ?? item.startAt, 2),
                  });
                }}
                eventResize={(info) => {
                  const item = info.event.extendedProps as CalendarItem;
                  moveItem.mutate({
                    item,
                    startAt: info.event.start?.toISOString() ?? item.startAt,
                    endAt: info.event.end?.toISOString() ?? item.endAt,
                  });
                }}
              />
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {draft ? (
            <CalendarEditor
              draft={draft}
              saving={saveEvent.isPending || deleteEvent.isPending}
              onChange={setDraft}
              onSave={() => saveEvent.mutate(draft)}
              onDelete={draft.id ? () => deleteEvent.mutate(draft.id!) : undefined}
              onCancel={() => setDraft(null)}
            />
          ) : selectedItem?.source === "booking" ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-xl font-semibold">{selectedItem.booking?.name}</h3>
                <Badge>{EVENT_TYPE_LABELS.booking}</Badge>
                <Badge variant="outline">{STATUS_LABELS[selectedItem.status] ?? selectedItem.status}</Badge>
              </div>
              <a href={`tel:${selectedItem.booking?.phone}`} className="mt-3 block text-sm hover:underline">
                {selectedItem.booking?.phone}
              </a>
              {selectedItem.booking?.telegram && (
                <p className="mt-1 text-sm text-muted-foreground">{selectedItem.booking.telegram}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                {selectedItem.booking?.guests} гост. · {toDateTimeLocal(selectedItem.startAt).replace("T", " ")}
              </p>
              {selectedItem.booking?.comment && <p className="mt-3 text-sm">{selectedItem.booking.comment}</p>}
              <p className="mt-4 text-xs text-muted-foreground">
                Бронь можно переносить drag/drop в календаре. Статус и детали меняются в журнале заявок ниже.
              </p>
            </Card>
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">
              Выберите слот, событие или бронь. Ручные события можно редактировать и удалять, брони можно переносить по сетке.
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-medium">Легенда</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge style={{ backgroundColor: "#7a3b22" }}>Бронь</Badge>
              <Badge style={{ backgroundColor: "#2563eb" }}>Мероприятие</Badge>
              <Badge style={{ backgroundColor: "#4e7c63" }}>Церемония</Badge>
              <Badge style={{ backgroundColor: "#334155" }}>Закрыто</Badge>
              <Badge style={{ backgroundColor: "#c08a3e" }}>Черновик</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
