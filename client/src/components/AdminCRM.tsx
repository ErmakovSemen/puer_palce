import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, MessageCircle, Plus, RefreshCw, Search, StickyNote, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;
type CrmTask = { id: number; contactId: number; title: string; kind: string; dueAt: string | null; status: "open" | "done"; createdAt: string };
type CrmActivity = { id: number; contactId: number; kind: string; body: string; createdAt: string };
type CrmContact = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  source: string;
  stage: Stage;
  workStatus: "new" | "in_progress" | "waiting" | "done";
  ownerId: number | null;
  ownerName: string | null;
  tags: string[];
  notes: string | null;
  lastContactAt: string | null;
  lastVisitAt: string | null;
  createdAt: string;
  tasks: CrmTask[];
  activities: CrmActivity[];
};
type Stage = "lead" | "active" | "regular" | "at_risk" | "inactive";

const STAGES: Record<Stage, { label: string; className: string }> = {
  lead: { label: "Лид", className: "bg-amber-100 text-amber-900 border-amber-200" },
  active: { label: "Активный", className: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  regular: { label: "Постоянный", className: "bg-sky-100 text-sky-900 border-sky-200" },
  at_risk: { label: "Риск оттока", className: "bg-orange-100 text-orange-900 border-orange-200" },
  inactive: { label: "Неактивен", className: "bg-stone-100 text-stone-700 border-stone-200" },
};

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value)) : "нет";
const emptyNewContact = { name: "", phone: "", telegram: "", source: "manual", stage: "lead" as Stage, tags: "" };

export default function AdminCRM({ adminFetch, enabled }: { adminFetch: AdminFetch; enabled: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newContact, setNewContact] = useState(emptyNewContact);
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

  const { data: contacts = [], isLoading } = useQuery<CrmContact[]>({
    queryKey: ["/api/admin/crm/contacts"],
    queryFn: () => adminFetch("/api/admin/crm/contacts"),
    enabled,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/crm/contacts"] });

  const createContact = useMutation({
    mutationFn: () => adminFetch("/api/admin/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newContact,
        phone: newContact.phone || null,
        telegram: newContact.telegram || null,
        tags: newContact.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      }),
    }),
    onSuccess: () => {
      refresh();
      setCreateOpen(false);
      setNewContact(emptyNewContact);
      toast({ title: "Лид добавлен" });
    },
    onError: (error: Error) => toast({ title: "Не удалось добавить", description: error.message, variant: "destructive" }),
  });

  const updateContact = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => adminFetch(`/api/admin/crm/contacts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
    onSuccess: () => { refresh(); toast({ title: "Карточка обновлена" }); },
    onError: (error: Error) => toast({ title: "Не удалось обновить", description: error.message, variant: "destructive" }),
  });

  const addNote = useMutation({
    mutationFn: () => adminFetch(`/api/admin/crm/contacts/${selected?.id}/activities`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: note }),
    }),
    onSuccess: () => { refresh(); setNote(""); toast({ title: "Заметка сохранена" }); },
    onError: (error: Error) => toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" }),
  });

  const addTask = useMutation({
    mutationFn: () => adminFetch(`/api/admin/crm/contacts/${selected?.id}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: taskTitle, kind: "follow_up" }),
    }),
    onSuccess: () => { refresh(); setTaskTitle(""); toast({ title: "Задача добавлена" }); },
    onError: (error: Error) => toast({ title: "Не удалось добавить", description: error.message, variant: "destructive" }),
  });

  const updateTask = useMutation({
    mutationFn: (task: CrmTask) => adminFetch(`/api/admin/crm/tasks/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: task.status === "open" ? "done" : "open" }),
    }),
    onSuccess: refresh,
  });

  const syncBookings = useMutation({
    mutationFn: () => adminFetch("/api/admin/crm/sync-bookings", { method: "POST" }),
    onSuccess: (data) => { refresh(); toast({ title: "Записи перенесены", description: `${data.synced} заявок проверено` }); },
    onError: (error: Error) => toast({ title: "Синхронизация не удалась", description: error.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => contacts.filter((contact) => {
    const haystack = [contact.name, contact.phone, contact.telegram, contact.source, ...(contact.tags || [])].filter(Boolean).join(" ").toLowerCase();
    return (stage === "all" || contact.stage === stage) && haystack.includes(query.toLowerCase());
  }), [contacts, query, stage]);
  const openTasks = contacts.flatMap((contact) => contact.tasks.filter((task) => task.status === "open").map((task) => ({ ...task, contact }))).slice(0, 6);
  const summary = {
    leads: contacts.filter((contact) => contact.stage === "lead").length,
    risk: contacts.filter((contact) => contact.stage === "at_risk").length,
    tasks: contacts.flatMap((contact) => contact.tasks).filter((task) => task.status === "open").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">CRM</h2>
          <p className="mt-1 text-sm text-muted-foreground">Контакты, касания и очередь на сегодня.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => syncBookings.mutate()} disabled={syncBookings.isPending}><RefreshCw className="mr-2 h-4 w-4" />Перенести записи</Button>
          <Button onClick={() => setCreateOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Добавить лида</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={UsersRound} label="Всего контактов" value={contacts.length} />
        <Metric icon={MessageCircle} label="Новые лиды" value={summary.leads} />
        <Metric icon={Clock3} label="Задачи в работе" value={summary.tasks} emphasis={summary.tasks > 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card>
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Клиенты и лиды</CardTitle>
              <div className="flex gap-2">
                <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="w-full pl-9 sm:w-56" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон, тег" /></div>
                <Select value={stage} onValueChange={(value) => setStage(value as Stage | "all")}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все</SelectItem>{Object.entries(STAGES).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <p className="p-6 text-sm text-muted-foreground">Загружаем CRM...</p> : filtered.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Контактов пока нет. Перенесите записи или добавьте первый лид.</p> : <div className="divide-y">{filtered.map((contact) => <button key={contact.id} onClick={() => setSelected(contact)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary font-serif text-sm font-semibold">{contact.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-medium">{contact.name}</span><Badge variant="outline" className={STAGES[contact.stage].className}>{STAGES[contact.stage].label}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{contact.ownerName ? `${contact.ownerName} · ${contact.workStatus === "in_progress" ? "в работе" : contact.workStatus}` : "не назначен"} · {contact.telegram || contact.phone || contact.source}</p></div><div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><CheckCircle2 className="h-4 w-4" />{contact.tasks.filter((task) => task.status === "open").length}</div></button>)}</div>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Сегодня</CardTitle></CardHeader>
          <CardContent className="space-y-3">{openTasks.length === 0 ? <p className="text-sm text-muted-foreground">Открытых задач нет.</p> : openTasks.map((task) => <div key={task.id} className="flex gap-2"><Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => updateTask.mutate(task)} aria-label="Завершить задачу"><CheckCircle2 className="h-4 w-4" /></Button><button onClick={() => setSelected(task.contact)} className="min-w-0 text-left"><p className="text-sm font-medium leading-tight">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.contact.name}</p></button></div>)}</CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Новый лид</DialogTitle></DialogHeader><div className="space-y-3"><Field label="Имя"><Input value={newContact.name} onChange={(event) => setNewContact({ ...newContact, name: event.target.value })} autoFocus /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Телефон"><Input value={newContact.phone} onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })} /></Field><Field label="Telegram"><Input value={newContact.telegram} onChange={(event) => setNewContact({ ...newContact, telegram: event.target.value })} placeholder="@username" /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Источник"><Input value={newContact.source} onChange={(event) => setNewContact({ ...newContact, source: event.target.value })} placeholder="VK, рекомендация..." /></Field><Field label="Статус"><Select value={newContact.stage} onValueChange={(value) => setNewContact({ ...newContact, stage: value as Stage })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STAGES).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Теги через запятую"><Input value={newContact.tags} onChange={(event) => setNewContact({ ...newContact, tags: event.target.value })} placeholder="церемонии, шен" /></Field><Button className="w-full" onClick={() => createContact.mutate()} disabled={createContact.isPending}>Добавить</Button></div></DialogContent></Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>{selected && <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{selected.name}<Badge variant="outline" className={STAGES[selected.stage].className}>{STAGES[selected.stage].label}</Badge></DialogTitle></DialogHeader><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><Field label="Статус"><Select value={selected.stage} onValueChange={(value) => { updateContact.mutate({ id: selected.id, body: { stage: value } }); setSelected({ ...selected, stage: value as Stage }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STAGES).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select></Field><Field label="Источник"><Input value={selected.source} onBlur={(event) => event.target.value !== selected.source && updateContact.mutate({ id: selected.id, body: { source: event.target.value } })} /></Field></div><div className="rounded-md border bg-muted/30 p-3 text-sm"><p>{selected.telegram || "Нет Telegram"}</p><p className="text-muted-foreground">{selected.phone || "Нет телефона"} · последний визит: {formatDate(selected.lastVisitAt)}</p>{selected.telegram && <a className="mt-2 inline-flex items-center text-primary underline" href={`https://t.me/${selected.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" />Написать в Telegram</a>}</div><section><h3 className="mb-2 text-sm font-semibold">Новая задача</h3><div className="flex gap-2"><Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Например: позвать на вечернюю церемонию" onKeyDown={(event) => event.key === "Enter" && addTask.mutate()} /><Button size="icon" onClick={() => addTask.mutate()} disabled={!taskTitle.trim()} aria-label="Добавить задачу"><Plus className="h-4 w-4" /></Button></div>{selected.tasks.filter((task) => task.status === "open").map((task) => <div key={task.id} className="mt-2 flex items-center gap-2 text-sm"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTask.mutate(task)} aria-label="Завершить"><CheckCircle2 className="h-4 w-4" /></Button>{task.title}</div>)}</section><section><h3 className="mb-2 text-sm font-semibold">Заметка о касании</h3><div className="flex gap-2"><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="О чем договорились, что интересно клиенту" className="min-h-20" /><Button size="icon" className="h-10" onClick={() => addNote.mutate()} disabled={!note.trim()} aria-label="Сохранить заметку"><StickyNote className="h-4 w-4" /></Button></div></section><section><h3 className="mb-2 text-sm font-semibold">История</h3><div className="space-y-2">{selected.activities.length === 0 ? <p className="text-sm text-muted-foreground">Истории пока нет.</p> : selected.activities.map((activity) => <div key={activity.id} className="border-l-2 border-border pl-3 text-sm"><p>{activity.body}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p></div>)}</div></section></div></DialogContent>}</Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value, emphasis }: { icon: typeof UsersRound; label: string; value: number; emphasis?: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={emphasis ? "h-5 w-5 text-orange-700" : "h-5 w-5 text-muted-foreground"} /><div><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="grid gap-1.5 text-sm">{label}{children}</Label>;
}
