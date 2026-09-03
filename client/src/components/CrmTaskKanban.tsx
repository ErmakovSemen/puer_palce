import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, GripVertical, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;
type TaskStatus = "open" | "in_progress" | "done";
type Task = {
  id: number;
  title: string;
  dueAt: string | null;
  status: TaskStatus;
  ownerId: number | null;
  ownerName: string | null;
  contactId: number | null;
  contactName: string | null;
};
type Admin = { id: number; name: string; isActive: boolean };

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "open", label: "К выполнению", color: "border-amber-400" },
  { id: "in_progress", label: "В работе", color: "border-sky-500" },
  { id: "done", label: "Готово", color: "border-emerald-500" },
];

const formatDueAt = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "без срока";

export default function CrmTaskKanban({
  adminFetch,
  enabled,
}: {
  adminFetch: AdminFetch;
  enabled: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [filterOwner, setFilterOwner] = useState("all");
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/admin/crm/tasks"],
    queryFn: () => adminFetch("/api/admin/crm/tasks"),
    enabled,
  });
  const { data: admins = [] } = useQuery<Admin[]>({
    queryKey: ["/api/admin/crm/admins"],
    queryFn: () => adminFetch("/api/admin/crm/admins"),
    enabled,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crm/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crm/contacts"] });
  };
  const createTask = useMutation({
    mutationFn: () =>
      adminFetch("/api/admin/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ownerId: ownerId ? Number(ownerId) : null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      setTitle("");
      setDueAt("");
      refresh();
      toast({ title: "Задача создана" });
    },
    onError: () =>
      toast({ title: "Не удалось создать задачу", variant: "destructive" }),
  });
  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      adminFetch(`/api/admin/crm/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: refresh,
    onError: () =>
      toast({ title: "Не удалось обновить задачу", variant: "destructive" }),
  });
  const visibleTasks = useMemo(
    () =>
      filterOwner === "all"
        ? tasks
        : tasks.filter((task) => task.ownerId === Number(filterOwner)),
    [tasks, filterOwner],
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const status = String(over?.id) as TaskStatus;
    if (COLUMNS.some((column) => column.id === status))
      updateTask.mutate({ id: Number(active.id), status });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_auto] lg:items-end">
            <Field label="Новая задача">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: подготовить чайную станцию"
              />
            </Field>
            <Field label="Исполнитель">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Не назначен" /></SelectTrigger>
                <SelectContent>
                  {admins.filter((admin) => admin.isActive).map((admin) => (
                    <SelectItem key={admin.id} value={String(admin.id)}>{admin.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Срок">
              <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </Field>
            <Button onClick={() => createTask.mutate()} disabled={!title.trim() || createTask.isPending}>
              <Plus className="mr-2 h-4 w-4" />Добавить
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-muted-foreground" />
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все сотрудники</SelectItem>
            {admins.filter((admin) => admin.isActive).map((admin) => (
              <SelectItem key={admin.id} value={String(admin.id)}>{admin.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загружаем задачи…</p>
      ) : (
        <DndContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[900px] grid-cols-3 gap-3">
              {COLUMNS.map((column) => (
                <TaskColumn
                  key={column.id}
                  column={column}
                  tasks={visibleTasks.filter((task) => task.status === column.id)}
                  onStatusChange={(id, status) => updateTask.mutate({ id, status })}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  );
}

function TaskColumn({
  column,
  tasks,
  onStatusChange,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  onStatusChange: (id: number, status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section ref={setNodeRef} className={`min-h-[440px] rounded-md border-t-4 bg-muted/25 p-3 ${column.color} ${isOver ? "bg-primary/10" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{column.label}</h3>
        <span className="text-sm text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} />)}
      </div>
    </section>
  );
}

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: number, status: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <Card ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined} className={isDragging ? "opacity-50" : ""}>
      <CardContent className="p-3">
        <div className="flex gap-2">
          <button {...listeners} {...attributes} className="mt-0.5 cursor-grab text-muted-foreground" aria-label="Перетащить задачу"><GripVertical className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">{task.title}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{task.ownerName || "Не назначен"}</span>
              {task.contactName && <span>Клиент: {task.contactName}</span>}
              <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDueAt(task.dueAt)}</span>
            </div>
            <Select value={task.status} onValueChange={(status) => onStatusChange(task.id, status as TaskStatus)}>
              <SelectTrigger className="mt-3 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{COLUMNS.map((column) => <SelectItem key={column.id} value={column.id}>{column.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
