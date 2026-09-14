import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  MessageCircle,
  UserPlus,
} from "lucide-react";
import type { Contact } from "./AdminCRM";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const stages: Record<string, string> = {
  new: "Новый",
  taken: "В работе",
  first_contact: "Связались",
  dialog: "Диалог",
  booked: "Записан",
  visited: "Пришёл",
  lost: "Неактуально",
};
const results = {
  no_answer: "Не ответил",
  message: "Написали",
  interested: "Заинтересован",
  booked: "Записался",
  visited: "Пришёл",
  refused: "Отказ / не писать",
};
type Result = keyof typeof results;
type Props = {
  contacts: Contact[];
  ownerId: number | null;
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
};

export default function CrmLeadWorkbench({
  contacts,
  ownerId,
  adminFetch,
}: Props) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [source, setSource] = useState("all");
  const [stage, setStage] = useState("all");
  const [channel, setChannel] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Result>("no_answer");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const leads = contacts.filter((c) => c.externalId || c.stage === "lead");
  const rows = leads.filter(
    (c) =>
      [c.name, c.phone, c.telegram, c.source, ...c.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (scope === "all" ||
        (scope === "mine" ? !!ownerId && c.ownerId === ownerId : !c.ownerId)) &&
      (source === "all" || c.source === source) &&
      (stage === "all" || (stage === "waiting" ? c.workStatus === "waiting" : c.pipelineStage === stage)) &&
      (channel === "all" ||
        (channel === "phone"
          ? c.phone
          : channel === "vk"
            ? vkLink(c)
            : c.telegram)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 40));
  const currentPage = Math.min(page, pages - 1);
  const selected = contacts.find((c) => c.id === selectedId);
  const refresh = async () => {
    await Promise.all(
      ["contacts", "tasks", "users"].map((key) =>
        qc.invalidateQueries({ queryKey: [`/api/admin/crm/${key}`] }),
      ),
    );
  };
  const action = useMutation({
    mutationFn: ({
      id,
      take,
      next,
    }: {
      id: number;
      take?: boolean;
      next?: number | null;
    }) =>
      adminFetch(`/api/admin/crm/contacts/${id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          outcome: take ? "take" : outcome,
          note: take ? "" : note,
          dueAt: !take && dueAt ? new Date(dueAt).toISOString() : null,
        }),
      }),
    onSuccess: async (_, variables) => {
      await refresh();
      setNote("");
      setDueAt("");
      if (variables.next !== undefined) { setSelectedId(variables.next); setOutcome("no_answer"); }
      toast({
        title: variables.take ? "Лид взят в работу" : "Результат сохранён",
      });
    },
    onError: (error: Error) =>
      toast({
        title: "Не удалось сохранить",
        description: error.message,
        variant: "destructive",
      }),
  });
  const open = (id: number) => {
    setSelectedId(id);
    setNote("");
    setDueAt("");
    setOutcome("no_answer");
  };
  const selectClass =
    "h-10 min-w-0 rounded-md border bg-background px-3 text-sm";
  const next =
    rows.find(
      (c) =>
        c.id !== selectedId &&
        (!c.ownerId || c.ownerId === ownerId) &&
        !["visited", "lost", "booked"].includes(c.pipelineStage),
    )?.id ?? null;
  return (
    <section className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          aria-label="Поиск лидов"
          placeholder="Имя, телефон, тег"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Ответственный"
          className={selectClass}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Все лиды</option>
          <option value="unassigned">Без ответственного</option>
          <option value="mine">Мои лиды</option>
        </select>
        <select
          aria-label="Источник"
          className={selectClass}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Все источники</option>
          {Array.from(new Set(leads.map((c) => c.source)))
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <select
          aria-label="Статус"
          className={selectClass}
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Все статусы</option>
          <option value="waiting">Ждём ответа</option>
          {Object.entries(stages).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Канал связи"
          className={selectClass}
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Все каналы</option>
          <option value="phone">Есть телефон</option>
          <option value="vk">Есть VK</option>
          <option value="telegram">Есть Telegram</option>
        </select>
      </div>
      {!ownerId && (
        <p className="text-sm text-muted-foreground">
          Выберите своё имя сверху, чтобы брать лидов и сохранять результаты.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">
          Найдено: {rows.length} из {leads.length}
        </span>
        <Button disabled={!ownerId || !next} onClick={() => next && open(next)}>
          <Phone className="mr-2 h-4 w-4" />
          Начать обработку
        </Button>
      </div>
      <div className="divide-y border-y">
        {rows.slice(currentPage * 40, (currentPage + 1) * 40).map((c) => (
          <button
            key={c.id}
            onClick={() => open(c.id)}
            className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-muted/40"
          >
            <span className="min-w-0">
              <span className="block font-medium break-words">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.source} · {c.ownerName || "Без ответственного"} ·{" "}
                {c.phone || (vkLink(c) ? "VK" : c.telegram || "Нет контактов")}
              </span>
            </span>
            <span className="text-sm">
              {c.workStatus === "waiting" ? "Ждём ответа" : stages[c.pipelineStage] || c.pipelineStage}
            </span>
          </button>
        ))}
        {!rows.length && (
          <p className="py-6 text-muted-foreground">
            Лидов по этим фильтрам нет.
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Предыдущая страница"
          disabled={!currentPage}
          onClick={() => setPage(currentPage - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span>
          {currentPage + 1} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Следующая страница"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(value) => {
          if (!value && !action.isPending) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p className="text-sm">
                {stages[selected.pipelineStage]} ·{" "}
                {selected.ownerName || "Без ответственного"} · {selected.source}
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.phone && (
                  <Button asChild variant="outline">
                    <a href={`tel:${selected.phone.replace(/[^+\d]/g, "")}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Позвонить
                    </a>
                  </Button>
                )}
                {vkLink(selected) && (
                  <Button asChild variant="outline">
                    <a
                      href={vkLink(selected)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Открыть VK
                    </a>
                  </Button>
                )}
                {selected.telegram && (
                  <Button asChild variant="outline">
                    <a
                      href={`https://t.me/${selected.telegram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Telegram
                    </a>
                  </Button>
                )}
              </div>
              {selected.notes && (
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {selected.notes}
                </p>
              )}
              {!selected.ownerId && (
                <Button
                  disabled={!ownerId || action.isPending}
                  onClick={() => action.mutate({ id: selected.id, take: true })}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Взять себе
                </Button>
              )}
              {selected.ownerId === ownerId && ownerId ? (
                <>
                  <label className="block text-sm">
                    Результат контакта
                    <select
                      className={`${selectClass} mt-1 w-full`}
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as Result)}
                    >
                      {Object.entries(results).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Комментарий
                    <Textarea
                      className="mt-1"
                      maxLength={1000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {!["refused", "visited"].includes(outcome) && (
                    <label className="block text-sm">
                      Следующее касание (необязательно)
                      <Input
                        type="datetime-local"
                        className="mt-1"
                        value={dueAt}
                        onChange={(e) => setDueAt(e.target.value)}
                      />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: selected.id })}
                    >
                      Сохранить
                    </Button>
                    <Button
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: selected.id, next })}
                    >
                      Сохранить и следующий
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : selected.ownerId ? (
                <p className="text-sm text-muted-foreground">
                  Лид уже закреплён за{" "}
                  {selected.ownerName || "другим сотрудником"}.
                </p>
              ) : null}
              <div className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-semibold">Последние контакты</h3>
                {selected.activities.map((a) => (
                  <div key={a.id} className="border-l-2 pl-3 text-sm">
                    <p className="whitespace-pre-wrap break-words">{a.body}</p>
                    <time className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("ru-RU")}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function vkLink(contact: Contact) {
  if (
    contact.profileUrl &&
    /^https:\/\/(?:www\.)?vk\.(?:com|ru)\//i.test(contact.profileUrl)
  )
    return contact.profileUrl;
  return contact.externalId && /^\d+$/.test(contact.externalId)
    ? `https://vk.com/id${contact.externalId}`
    : null;
}
