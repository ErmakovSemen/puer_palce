import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  GripVertical,
  Inbox,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import CrmTaskKanban from "@/components/CrmTaskKanban";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;
type Lifecycle = "lead" | "active" | "regular" | "at_risk" | "inactive";
type Pipeline =
  "new" | "taken" | "first_contact" | "dialog" | "booked" | "visited" | "lost";
type Task = {
  id: number;
  contactId: number;
  title: string;
  kind: string;
  dueAt: string | null;
  status: "open" | "done";
  createdAt: string;
};
type Contact = {
  id: number;
  name: string;
  phone: string | null;
  telegram: string | null;
  profileUrl: string | null;
  source: string;
  stage: Lifecycle;
  pipelineStage: Pipeline;
  inboxStatus: "none" | "new" | "taken";
  workStatus: string;
  ownerId: number | null;
  ownerName: string | null;
  tags: string[];
  lastVisitAt: string | null;
  tasks: Task[];
  activities: { id: number; body: string; createdAt: string }[];
};
type Admin = { id: number; name: string; isActive: boolean };
type Customer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  xp: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  lastXpAccrualAt: string | null;
  ownerId: number | null;
  ownerName: string | null;
  crmContactId: number | null;
};
type View = "queue" | "inbox" | "pipeline" | "tasks" | "customers" | "contacts";

const LIFECYCLE: Record<Lifecycle, { label: string; className: string }> = {
  lead: {
    label: "Лид",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  active: {
    label: "Активный",
    className: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  regular: {
    label: "Постоянный",
    className: "bg-sky-100 text-sky-900 border-sky-200",
  },
  at_risk: {
    label: "Риск оттока",
    className: "bg-orange-100 text-orange-900 border-orange-200",
  },
  inactive: {
    label: "Неактивен",
    className: "bg-stone-100 text-stone-700 border-stone-200",
  },
};
const STAGES: { id: Exclude<Pipeline, "new">; label: string; color: string }[] =
  [
    { id: "taken", label: "Взяли в работу", color: "border-stone-300" },
    { id: "first_contact", label: "Первый контакт", color: "border-amber-300" },
    { id: "dialog", label: "Диалог", color: "border-sky-300" },
    { id: "booked", label: "Записан", color: "border-emerald-300" },
    { id: "visited", label: "Пришел", color: "border-emerald-500" },
    { id: "lost", label: "Неактуально", color: "border-stone-400" },
  ];
const fmt = (date?: string | null) =>
  date
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(date))
    : "не назначено";
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const leadBlank = {
  name: "",
  phone: "",
  telegram: "",
  source: "manual",
  tags: "",
};

export default function AdminCRM({
  adminFetch,
  enabled,
}: {
  adminFetch: AdminFetch;
  enabled: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("queue");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [activeOwnerId, setActiveOwnerId] = useState(
    () => sessionStorage.getItem("crmActiveAdminId") || "",
  );
  const ownerId = Number(activeOwnerId) || null;
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState(leadBlank);
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskKind, setTaskKind] = useState("call");
  const [dueAt, setDueAt] = useState("");
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/admin/crm/contacts"],
    queryFn: () => adminFetch("/api/admin/crm/contacts"),
    enabled,
  });
  const { data: admins = [] } = useQuery<Admin[]>({
    queryKey: ["/api/admin/crm/admins"],
    queryFn: () => adminFetch("/api/admin/crm/admins"),
    enabled,
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/admin/crm/users"],
    queryFn: () => adminFetch("/api/admin/crm/users"),
    enabled,
  });
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["/api/admin/crm/contacts"] });
  const refreshAdmins = () =>
    qc.invalidateQueries({ queryKey: ["/api/admin/crm/admins"] });
  const setOwner = (id: string) => {
    setActiveOwnerId(id);
    sessionStorage.setItem("crmActiveAdminId", id);
  };
  const patch = (id: number, body: Record<string, unknown>) =>
    adminFetch(`/api/admin/crm/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const createAdmin = useMutation({
    mutationFn: () =>
      adminFetch("/api/admin/crm/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adminName }),
      }),
    onSuccess: (admin: Admin) => {
      setOwner(String(admin.id));
      setAdminName("");
      setAdminOpen(false);
      refreshAdmins();
      toast({ title: "Вы выбраны ответственным" });
    },
    onError: errorToast(toast, "Не удалось добавить сотрудника"),
  });
  const createLead = useMutation({
    mutationFn: () =>
      adminFetch("/api/admin/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          phone: lead.phone || null,
          telegram: lead.telegram || null,
          ownerId,
          workStatus: ownerId ? "in_progress" : "new",
          pipelineStage: ownerId ? "taken" : "new",
          tags: lead.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      refresh();
      setLeadOpen(false);
      setLead(leadBlank);
      toast({ title: "Лид добавлен" });
    },
    onError: errorToast(toast, "Не удалось добавить лид"),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      patch(id, body),
    onSuccess: () => {
      refresh();
      toast({ title: "Карточка обновлена" });
    },
    onError: errorToast(toast, "Не удалось обновить карточку"),
  });
  const take = useMutation({
    mutationFn: (ids: number[]) =>
      adminFetch("/api/admin/crm/contacts/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ownerId, pipelineStage: "taken" }),
      }),
    onSuccess: () => {
      refresh();
      toast({ title: "Лиды добавлены в вашу работу" });
    },
    onError: errorToast(toast, "Не удалось назначить лиды"),
  });
  const takeCustomer = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/api/admin/crm/users/${userId}/take`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId }),
      }),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["/api/admin/crm/users"] });
      toast({ title: "Клиент добавлен в вашу работу" });
    },
    onError: errorToast(toast, "Не удалось взять клиента"),
  });
  const addNote = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/crm/contacts/${selected?.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      }),
    onSuccess: () => {
      refresh();
      setNote("");
      toast({ title: "Заметка сохранена" });
    },
    onError: errorToast(toast, "Не удалось сохранить заметку"),
  });
  const addTask = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/crm/contacts/${selected?.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          kind: taskKind,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      refresh();
      setTaskTitle("");
      setDueAt("");
      toast({ title: "Следующее касание назначено" });
    },
    onError: errorToast(toast, "Не удалось поставить задачу"),
  });
  const complete = useMutation({
    mutationFn: (task: Task) =>
      adminFetch(`/api/admin/crm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: task.status === "open" ? "done" : "open",
        }),
      }),
    onSuccess: refresh,
  });
  const sync = useMutation({
    mutationFn: () =>
      adminFetch("/api/admin/crm/sync-bookings", { method: "POST" }),
    onSuccess: (data) => {
      refresh();
      toast({
        title: "Записи перенесены",
        description: `${data.synced} заявок проверено`,
      });
    },
    onError: errorToast(toast, "Синхронизация не удалась"),
  });
  const filtered = useMemo(
    () =>
      contacts.filter((c) =>
        [c.name, c.phone, c.telegram, c.source, ...c.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [contacts, search],
  );
  const mine = filtered.filter(
    (c) =>
      c.ownerId === ownerId && !["visited", "lost"].includes(c.pipelineStage),
  );
  const inbox = filtered.filter(
    (c) => c.inboxStatus === "new" || (!c.ownerId && c.pipelineStage === "new"),
  );
  const tasks = mine
    .flatMap((contact) =>
      contact.tasks
        .filter((task) => task.status === "open")
        .map((task) => ({ ...task, contact })),
    )
    .sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999"));
  const today = startOfDay(new Date());
  const overdue = tasks.filter(
    (task) => task.dueAt && new Date(task.dueAt).getTime() < today,
  );
  const todayTasks = tasks.filter(
    (task) => task.dueAt && startOfDay(new Date(task.dueAt)) === today,
  );
  const noStep = mine.filter(
    (c) => !c.tasks.some((task) => task.status === "open"),
  );
  const move = (id: number, next: Pipeline) =>
    update.mutate({
      id,
      body: {
        pipelineStage: next,
        workStatus: ["visited", "lost"].includes(next) ? "done" : "in_progress",
      },
    });
  const dragEnd = ({ active, over }: DragEndEvent) => {
    const stage = String(over?.id) as Pipeline;
    if (STAGES.some((item) => item.id === stage))
      move(Number(active.id), stage);
  };
  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            Рабочий стол CRM
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            В приоритете не только новые лиды, но и действующие клиенты.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Работаю как">
            <Select value={activeOwnerId} onValueChange={setOwner}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Выбрать себя" />
              </SelectTrigger>
              <SelectContent>
                {admins
                  .filter((a) => a.isActive)
                  .map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAdminOpen(true)}
            title="Добавить сотрудника"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Перенести записи
          </Button>
          <Button onClick={() => setLeadOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Добавить лида
          </Button>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={UsersRound}
          label="Клиенты в базе"
          value={customers.length}
        />
        <Metric
          icon={Inbox}
          label="Неразобранные лиды"
          value={inbox.length}
          emphasis={!!inbox.length}
        />
        <Metric
          icon={Clock3}
          label="Мои открытые задачи"
          value={tasks.length}
          emphasis={!!overdue.length}
        />
      </div>
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md bg-muted/50 p-1">
          <TabsTrigger value="queue">Моя очередь</TabsTrigger>
          <TabsTrigger value="customers">
            Клиенты{" "}
            <span className="ml-1 text-xs text-muted-foreground">
              {customers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="inbox">
            Входящие{" "}
            <span className="ml-1 text-xs text-muted-foreground">
              {inbox.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pipeline">Воронка</TabsTrigger>
          <TabsTrigger value="tasks">Задачи</TabsTrigger>
          <TabsTrigger value="contacts">Все контакты</TabsTrigger>
        </TabsList>
      </Tabs>
      {isLoading ? (
        <Empty title="Загружаем CRM" text="" />
      ) : (
        <>
          {view === "queue" && (
            <Queue
              ownerId={ownerId}
              overdue={overdue}
              today={todayTasks}
              noStep={noStep}
              onOpen={setSelected}
              onDone={(t) => complete.mutate(t)}
            />
          )}
          {view === "customers" && (
            <CustomerBase
              customers={customers}
              ownerId={ownerId}
              onTake={(id) => takeCustomer.mutate(id)}
              loading={takeCustomer.isPending}
            />
          )}
          {view === "inbox" && (
            <InboxView
              contacts={inbox}
              ownerId={ownerId}
              onOpen={setSelected}
              onTake={(ids) => take.mutate(ids)}
              loading={take.isPending}
            />
          )}
          {view === "pipeline" && (
            <DndContext onDragEnd={dragEnd}>
              <PipelineView
                ownerId={ownerId}
                contacts={filtered.filter(
                  (c) => c.ownerId === ownerId && c.pipelineStage !== "new",
                )}
                availableLeads={inbox}
                availableCustomers={customers.filter((c) => !c.ownerId)}
                onOpen={setSelected}
                onTakeLead={(id) => take.mutate([id])}
                onTakeCustomer={(id) => takeCustomer.mutate(id)}
                busy={take.isPending || takeCustomer.isPending}
              />
            </DndContext>
          )}
          {view === "tasks" && (
            <CrmTaskKanban
              adminFetch={adminFetch}
              enabled={enabled}
              currentAdminId={ownerId}
            />
          )}
          {view === "contacts" && (
            <ContactList
              contacts={filtered}
              search={search}
              setSearch={setSearch}
              onOpen={setSelected}
            />
          )}
        </>
      )}
      <LeadDialog
        contact={selected}
        close={() => setSelected(null)}
        admins={admins}
        ownerId={ownerId}
        take={() => selected && take.mutate([selected.id])}
        update={(id, body) => {
          update.mutate({ id, body });
          setSelected((c) => (c ? { ...c, ...body } : c));
        }}
        note={note}
        setNote={setNote}
        saveNote={() => addNote.mutate()}
        taskTitle={taskTitle}
        setTaskTitle={setTaskTitle}
        taskKind={taskKind}
        setTaskKind={setTaskKind}
        dueAt={dueAt}
        setDueAt={setDueAt}
        addTask={() => addTask.mutate()}
        done={(task) => complete.mutate(task)}
      />
      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый лид</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Имя">
              <Input
                autoFocus
                value={lead.name}
                onChange={(e) => setLead({ ...lead, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Телефон">
                <Input
                  value={lead.phone}
                  onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                />
              </Field>
              <Field label="Telegram">
                <Input
                  value={lead.telegram}
                  onChange={(e) =>
                    setLead({ ...lead, telegram: e.target.value })
                  }
                  placeholder="@username"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Источник">
                <Input
                  value={lead.source}
                  onChange={(e) => setLead({ ...lead, source: e.target.value })}
                />
              </Field>
              <Field label="Теги через запятую">
                <Input
                  value={lead.tags}
                  onChange={(e) => setLead({ ...lead, tags: e.target.value })}
                />
              </Field>
            </div>
            <Button
              className="w-full"
              disabled={!lead.name.trim() || createLead.isPending}
              onClick={() => createLead.mutate()}
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Кто работает с лидами</DialogTitle>
          </DialogHeader>
          <Field label="Имя сотрудника">
            <Input
              autoFocus
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
          </Field>
          <Button
            disabled={!adminName.trim() || createAdmin.isPending}
            onClick={() => createAdmin.mutate()}
          >
            Добавить и выбрать
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Queue({
  ownerId,
  overdue,
  today,
  noStep,
  onOpen,
  onDone,
}: {
  ownerId: number | null;
  overdue: (Task & { contact: Contact })[];
  today: (Task & { contact: Contact })[];
  noStep: Contact[];
  onOpen: (c: Contact) => void;
  onDone: (t: Task) => void;
}) {
  if (!ownerId)
    return (
      <Empty
        title="Выберите себя сверху"
        text="Тогда CRM покажет только ваши лиды и задачи на сегодня."
      />
    );
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <TaskBlock
        title="Просрочено"
        icon={Clock3}
        tone="text-orange-700"
        tasks={overdue}
        onOpen={onOpen}
        onDone={onDone}
      />
      <TaskBlock
        title="Сегодня"
        icon={CalendarClock}
        tasks={today}
        onOpen={onOpen}
        onDone={onDone}
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Нет следующего шага</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {noStep.length ? (
            noStep
              .slice(0, 8)
              .map((c) => <LeadRow key={c.id} contact={c} onOpen={onOpen} />)
          ) : (
            <p className="text-sm text-muted-foreground">
              Все лиды с запланированным касанием.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function TaskBlock({
  title,
  icon: Icon,
  tone,
  tasks,
  onOpen,
  onDone,
}: {
  title: string;
  icon: typeof Clock3;
  tone?: string;
  tasks: (Task & { contact: Contact })[];
  onOpen: (c: Contact) => void;
  onDone: (t: Task) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle
          className={`flex items-center gap-2 text-base ${tone || ""}`}
        >
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length ? (
          tasks.slice(0, 8).map((task) => (
            <div key={task.id} className="flex gap-2 rounded-md border p-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onDone(task)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <button
                className="min-w-0 text-left"
                onClick={() => onOpen(task.contact)}
              >
                <p className="text-sm font-medium">{task.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {task.contact.name} · {fmt(task.dueAt)}
                </p>
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Пусто.</p>
        )}
      </CardContent>
    </Card>
  );
}
function InboxView({
  contacts,
  ownerId,
  onOpen,
  onTake,
  loading,
}: {
  contacts: Contact[];
  ownerId: number | null;
  onOpen: (c: Contact) => void;
  onTake: (ids: number[]) => void;
  loading: boolean;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const first = contacts.slice(0, 50).map((c) => c.id);
  const toggle = (id: number) =>
    setPicked((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Новые обращения</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Видны всем менеджерам, пока кто-то не возьмёт обращение.
          </p>
        </div>
        <Button
          disabled={!ownerId || loading || !contacts.length}
          onClick={() => onTake(picked.length ? picked : first)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {picked.length ? `Взять ${picked.length}` : "Взять первые 50"}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {!ownerId && (
          <p className="px-6 pb-4 text-sm text-orange-700">
            Выберите себя сверху, чтобы взять обращения в работу.
          </p>
        )}
        {contacts.length ? (
          <div className="divide-y">
            {contacts.slice(0, 100).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  aria-label={`Выбрать ${c.name}`}
                  checked={picked.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 accent-primary"
                />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onOpen(c)}
                >
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.source} · {c.telegram || c.phone || "нет контакта"}
                  </p>
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!ownerId || loading}
                  onClick={() => onTake([c.id])}
                >
                  Взять
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Новых обращений нет.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function CustomerBase({
  customers,
  ownerId,
  onTake,
  loading,
}: {
  customers: Customer[];
  ownerId: number | null;
  onTake: (id: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const rows = customers.filter((c) => {
    const haystack = [c.name, c.phone, c.email, c.source]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (segment === "all" ||
        (segment === "buyers" && c.orderCount > 0) ||
        (segment === "loyal" && c.xp >= 100) ||
        (segment === "not_mine" && c.ownerId !== ownerId))
    );
  });
  return (
    <Card>
      <CardHeader className="gap-3">
        <div>
          <CardTitle className="text-lg">Клиентская база</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Покупатели и постоянники. Возьмите клиента, чтобы он появился в
            вашей воронке и очереди касаний.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Имя, телефон, email"
            />
          </div>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все клиенты</SelectItem>
              <SelectItem value="buyers">Покупали</SelectItem>
              <SelectItem value="loyal">Постоянники</SelectItem>
              <SelectItem value="not_mine">Не у меня</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!ownerId && (
          <p className="px-6 pb-4 text-sm text-orange-700">
            Сначала выберите себя сверху, затем сможете брать клиентов в работу.
          </p>
        )}
        {rows.length ? (
          <div className="divide-y">
            {rows.slice(0, 200).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary font-serif">
                  {(c.name || c.phone || "К").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">
                      {c.name || c.phone || "Без имени"}
                    </p>
                    {c.orderCount > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-100 text-emerald-900 border-emerald-200"
                      >
                        {c.orderCount} покупок
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.phone || c.email || "нет контакта"} ·{" "}
                    {c.totalSpent.toLocaleString("ru-RU")} ₽ ·{" "}
                    {c.ownerName || "не в работе"}
                  </p>
                </div>
                <Button
                  variant={c.ownerId === ownerId ? "secondary" : "outline"}
                  size="sm"
                  disabled={!ownerId || loading || c.ownerId === ownerId}
                  onClick={() => onTake(c.id)}
                >
                  {c.ownerId === ownerId ? "У вас" : "Взять в работу"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Клиентов по этому фильтру нет.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function PipelineView({
  ownerId,
  contacts,
  availableLeads,
  availableCustomers,
  onOpen,
  onTakeLead,
  onTakeCustomer,
  busy,
}: {
  ownerId: number | null;
  contacts: Contact[];
  availableLeads: Contact[];
  availableCustomers: Customer[];
  onOpen: (c: Contact) => void;
  onTakeLead: (id: number) => void;
  onTakeCustomer: (id: string) => void;
  busy: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!ownerId)
    return (
      <Empty
        title="Выберите себя сверху"
        text="Воронка показывает только лиды выбранного ответственного."
      />
    );
  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              contacts={contacts.filter((c) => c.pipelineStage === stage.id)}
              onOpen={onOpen}
              onAdd={
                stage.id === "taken" ? () => setPickerOpen(true) : undefined
              }
            />
          ))}
        </div>
      </div>
      <KanbanPicker
        open={pickerOpen}
        setOpen={setPickerOpen}
        leads={availableLeads}
        customers={availableCustomers}
        busy={busy}
        takeLead={onTakeLead}
        takeCustomer={onTakeCustomer}
      />
    </>
  );
}
function Column({
  stage,
  contacts,
  onOpen,
  onAdd,
}: {
  stage: (typeof STAGES)[number];
  contacts: Contact[];
  onOpen: (c: Contact) => void;
  onAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[440px] rounded-md border-t-4 bg-muted/25 p-3 ${stage.color} ${isOver ? "bg-primary/10" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{stage.label}</h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {contacts.length}
          </span>
          {onAdd && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onAdd}
              title="Взять из общего пула"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {contacts.map((c) => (
          <DragLead key={c.id} contact={c} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
function KanbanPicker({
  open,
  setOpen,
  leads,
  customers,
  busy,
  takeLead,
  takeCustomer,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  leads: Contact[];
  customers: Customer[];
  busy: boolean;
  takeLead: (id: number) => void;
  takeCustomer: (id: string) => void;
}) {
  const [kind, setKind] = useState<"leads" | "customers">("leads");
  const [query, setQuery] = useState("");
  const [leadSource, setLeadSource] = useState("all");
  const [leadTag, setLeadTag] = useState("all");
  const [customerSegment, setCustomerSegment] = useState("all");
  const sources = Array.from(
    new Set(leads.map((c) => c.source).filter(Boolean)),
  ).sort();
  const tags = Array.from(new Set(leads.flatMap((c) => c.tags))).sort();
  const now = Date.now();
  const matches = (values: (string | null | undefined)[]) =>
    values
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  const leadRows = leads.filter(
    (c) =>
      matches([c.name, c.phone, c.telegram, c.source]) &&
      (leadSource === "all" || c.source === leadSource) &&
      (leadTag === "all" || c.tags.includes(leadTag)),
  );
  const customerRows = customers.filter((c) => {
    const stale =
      c.lastXpAccrualAt &&
      now - new Date(c.lastXpAccrualAt).getTime() > 90 * 24 * 60 * 60 * 1000;
    return (
      matches([c.name, c.phone, c.email, c.source]) &&
      (customerSegment === "all" ||
        (customerSegment === "buyers" && c.orderCount > 0) ||
        (customerSegment === "loyal" && c.xp >= 100) ||
        (customerSegment === "stale" && stale) ||
        (customerSegment === "new" && c.orderCount === 0))
    );
  });
  const chooseLead = (id: number) => {
    takeLead(id);
    setOpen(false);
  };
  const chooseCustomer = (id: string) => {
    takeCustomer(id);
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Добавить в работу</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Выберите контакт из общего пула. Он сразу попадет в столбец «Взяли в
          работу».
        </p>
        <Tabs
          value={kind}
          onValueChange={(value) => setKind(value as "leads" | "customers")}
        >
          <TabsList>
            <TabsTrigger value="leads">Лиды {leads.length}</TabsTrigger>
            <TabsTrigger value="customers">
              Клиенты {customers.length}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или контакту"
          />
        </div>
        {kind === "leads" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={leadSource} onValueChange={setLeadSource}>
              <SelectTrigger>
                <SelectValue placeholder="Источник" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={leadTag} onValueChange={setLeadTag}>
              <SelectTrigger>
                <SelectValue placeholder="Тег" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все теги</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Select value={customerSegment} onValueChange={setCustomerSegment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все клиенты</SelectItem>
              <SelectItem value="buyers">Покупали</SelectItem>
              <SelectItem value="loyal">Постоянники: XP 100+</SelectItem>
              <SelectItem value="stale">Без начислений XP 90+ дней</SelectItem>
              <SelectItem value="new">Без покупок</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="divide-y rounded-md border">
          {kind === "leads"
            ? leadRows.slice(0, 100).map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.source} · {c.telegram || c.phone || "нет контакта"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => chooseLead(c.id)}
                  >
                    Взять
                  </Button>
                </div>
              ))
            : customerRows.slice(0, 100).map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.name || c.phone || "Без имени"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.orderCount} покупок ·{" "}
                      {c.totalSpent.toLocaleString("ru-RU")} ₽ · XP {c.xp}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => chooseCustomer(c.id)}
                  >
                    Взять
                  </Button>
                </div>
              ))}
          {(kind === "leads" ? leadRows : customerRows).length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">
              По этому фильтру контактов нет.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function DragLead({
  contact,
  onOpen,
}: {
  contact: Contact;
  onOpen: (c: Contact) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: contact.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      className={`rounded-md border bg-background p-3 shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex gap-1">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpen(contact)}
        >
          <p className="truncate text-sm font-semibold">{contact.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {contact.telegram || contact.phone || contact.source}
          </p>
          {contact.tasks.some((t) => t.status === "open") && (
            <p className="mt-2 text-xs text-orange-700">
              Есть следующее касание
            </p>
          )}
        </button>
        <button
          className="cursor-grab touch-none p-1 text-muted-foreground"
          aria-label="Перетащить лид"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
function ContactList({
  contacts,
  search,
  setSearch,
  onOpen,
}: {
  contacts: Contact[];
  search: string;
  setSearch: (v: string) => void;
  onOpen: (c: Contact) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg">Все контакты</CardTitle>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон, тег, источник"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {contacts.length ? (
          <div className="divide-y">
            {contacts.slice(0, 200).map((c) => (
              <button
                key={c.id}
                onClick={() => onOpen(c)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary font-serif">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <Badge
                      variant="outline"
                      className={LIFECYCLE[c.stage].className}
                    >
                      {LIFECYCLE[c.stage].label}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.ownerName || "не назначен"} · {c.source} ·{" "}
                    {c.telegram || c.phone || "нет контакта"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Ничего не найдено.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function LeadDialog({
  contact,
  close,
  admins,
  ownerId,
  take,
  update,
  note,
  setNote,
  saveNote,
  taskTitle,
  setTaskTitle,
  taskKind,
  setTaskKind,
  dueAt,
  setDueAt,
  addTask,
  done,
}: {
  contact: Contact | null;
  close: () => void;
  admins: Admin[];
  ownerId: number | null;
  take: () => void;
  update: (id: number, body: Record<string, unknown>) => void;
  note: string;
  setNote: (v: string) => void;
  saveNote: () => void;
  taskTitle: string;
  setTaskTitle: (v: string) => void;
  taskKind: string;
  setTaskKind: (v: string) => void;
  dueAt: string;
  setDueAt: (v: string) => void;
  addTask: () => void;
  done: (t: Task) => void;
}) {
  return (
    <Dialog open={!!contact} onOpenChange={(open) => !open && close()}>
      {contact && (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {contact.name}
              <Badge
                variant="outline"
                className={LIFECYCLE[contact.stage].className}
              >
                {LIFECYCLE[contact.stage].label}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Этап воронки">
                <Select
                  value={contact.pipelineStage}
                  onValueChange={(v) =>
                    update(contact.id, {
                      pipelineStage: v,
                      workStatus: ["visited", "lost"].includes(v)
                        ? "done"
                        : "in_progress",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Входящие</SelectItem>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ответственный">
                <Select
                  value={contact.ownerId ? String(contact.ownerId) : "none"}
                  onValueChange={(v) =>
                    update(contact.id, {
                      ownerId: v === "none" ? null : Number(v),
                      pipelineStage:
                        v === "none"
                          ? "new"
                          : contact.pipelineStage === "new"
                            ? "taken"
                            : contact.pipelineStage,
                      workStatus: v === "none" ? "new" : "in_progress",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
                    {admins
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {!contact.ownerId && ownerId && (
              <Button variant="outline" onClick={take}>
                <UserPlus className="mr-2 h-4 w-4" />
                Взять себе в работу
              </Button>
            )}
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                {contact.telegram || "Нет Telegram"} ·{" "}
                {contact.phone || "Нет телефона"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Источник: {contact.source} · последний визит:{" "}
                {fmt(contact.lastVisitAt)}
              </p>
              {contact.profileUrl && (
                <a
                  className="mt-2 inline-flex text-primary underline"
                  href={contact.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть профиль VK
                </a>
              )}
              {contact.telegram && (
                <a
                  className="ml-4 inline-flex text-primary underline"
                  href={`https://t.me/${contact.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Написать
                </a>
              )}
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Следующее касание</h3>
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Что сделать"
                />
                <Select value={taskKind} onValueChange={setTaskKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Звонок</SelectItem>
                    <SelectItem value="message">Сообщение</SelectItem>
                    <SelectItem value="follow_up">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
                <Button onClick={addTask} disabled={!taskTitle.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Поставить
                </Button>
              </div>
              {contact.tasks
                .filter((t) => t.status === "open")
                .map((task) => (
                  <div
                    key={task.id}
                    className="mt-2 flex items-center gap-2 text-sm"
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => done(task)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    {task.title}
                    <span className="text-xs text-muted-foreground">
                      {fmt(task.dueAt)}
                    </span>
                  </div>
                ))}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Заметка о касании</h3>
              <div className="flex gap-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="О чем договорились"
                  className="min-h-20"
                />
                <Button
                  size="icon"
                  className="h-10"
                  onClick={saveNote}
                  disabled={!note.trim()}
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">История</h3>
              <div className="space-y-2">
                {contact.activities.length ? (
                  contact.activities.map((a) => (
                    <div
                      key={a.id}
                      className="border-l-2 border-border pl-3 text-sm"
                    >
                      <p>{a.body}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmt(a.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Истории пока нет.
                  </p>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
function LeadRow({
  contact,
  onOpen,
}: {
  contact: Contact;
  onOpen: (c: Contact) => void;
}) {
  return (
    <button
      onClick={() => onOpen(contact)}
      className="block w-full rounded-md border p-3 text-left hover:bg-muted/50"
    >
      <p className="truncate text-sm font-medium">{contact.name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {contact.telegram || contact.phone || contact.source}
      </p>
    </button>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardContent className="p-8">
        <h3 className="font-semibold">{title}</h3>
        {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      </CardContent>
    </Card>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  emphasis,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon
          className={
            emphasis
              ? "h-5 w-5 text-orange-700"
              : "h-5 w-5 text-muted-foreground"
          }
        />
        <div>
          <p className="text-xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </Label>
  );
}
function errorToast(
  toast: ReturnType<typeof useToast>["toast"],
  title: string,
) {
  return (error: Error) =>
    toast({ title, description: error.message, variant: "destructive" });
}
