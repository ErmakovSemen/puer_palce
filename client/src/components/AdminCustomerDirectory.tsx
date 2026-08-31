import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  CheckCircle2,
  FileUp,
  Filter,
  Search,
  SlidersHorizontal,
  StickyNote,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;
type DirectoryUser = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
  xp: number;
  firstOrderDiscountUsed: boolean;
  customDiscount: number | null;
  walletBalance: number;
  analytics: string | null;
  source: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  lastOrderStatus: string | null;
  lastXpAccrualAt: string | null;
  crmContactId: number | null;
  ownerId: number | null;
  ownerName: string | null;
  workStatus: string | null;
};
type CrmAdmin = { id: number; name: string; isActive: boolean };
type CrmActivity = {
  id: number;
  contactId: number;
  kind: string;
  body: string;
  createdAt: string;
};
type CrmContact = {
  id: number;
  userId: string | null;
  name: string;
  phone: string | null;
  source: string;
  stage: "lead" | "active" | "regular" | "at_risk" | "inactive";
  workStatus: "new" | "in_progress" | "waiting" | "done";
  ownerId: number | null;
  ownerName: string | null;
  notes: string | null;
  activities: CrmActivity[];
};
type SortField =
  | "name"
  | "phone"
  | "email"
  | "xp"
  | "walletBalance"
  | "source"
  | "orderCount"
  | "totalSpent"
  | "lastXpAccrualAt";
type Filters = {
  search: string;
  source: string;
  minXp: string;
  maxXp: string;
  minBalance: string;
  maxBalance: string;
  verified: string;
  discount: string;
  firstDiscount: string;
  xpAccrualAge: string;
  lastXpAccrualFrom: string;
  lastXpAccrualTo: string;
  analytics: string;
};
const EMPTY: Filters = {
  search: "",
  source: "all",
  minXp: "",
  maxXp: "",
  minBalance: "",
  maxBalance: "",
  verified: "all",
  discount: "all",
  firstDiscount: "all",
  xpAccrualAge: "all",
  lastXpAccrualFrom: "",
  lastXpAccrualTo: "",
  analytics: "",
};
const dateFormat = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "-";
const STAGE_LABELS: Record<CrmContact["stage"], string> = {
  lead: "Лид",
  active: "Активный",
  regular: "Постоянный",
  at_risk: "Риск оттока",
  inactive: "Неактивный",
};
const WORK_STATUS_LABELS: Record<CrmContact["workStatus"], string> = {
  new: "Новый",
  in_progress: "В работе",
  waiting: "Ждем ответа",
  done: "Завершен",
};

export default function AdminCustomerDirectory({
  adminFetch,
  enabled,
}: {
  adminFetch: AdminFetch;
  enabled: boolean;
}) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sortBy, setSortBy] = useState<SortField>("lastXpAccrualAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [activeAdminId, setActiveAdminId] = useState(
    () => sessionStorage.getItem("crmActiveAdminId") || "",
  );
  const [newAdminName, setNewAdminName] = useState("");
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [note, setNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState("TargetHunter");
  const [importTags, setImportTags] = useState("холодный лид");
  const [importPreview, setImportPreview] = useState<{
    created: number;
    skipped: number;
    invalid: number;
    excluded: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery<DirectoryUser[]>({
    queryKey: ["/api/admin/crm/users"],
    queryFn: () => adminFetch("/api/admin/crm/users"),
    enabled,
  });
  const { data: admins = [] } = useQuery<CrmAdmin[]>({
    queryKey: ["/api/admin/crm/admins"],
    queryFn: () => adminFetch("/api/admin/crm/admins"),
    enabled,
  });
  const { data: contacts = [] } = useQuery<CrmContact[]>({
    queryKey: ["/api/admin/crm/contacts"],
    queryFn: () => adminFetch("/api/admin/crm/contacts"),
    enabled,
  });
  const addAdmin = useMutation({
    mutationFn: () =>
      adminFetch("/api/admin/crm/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAdminName }),
      }),
    onSuccess: (admin: CrmAdmin) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm/admins"] });
      setActiveAdminId(String(admin.id));
      sessionStorage.setItem("crmActiveAdminId", String(admin.id));
      setNewAdminName("");
    },
  });
  const refreshCrm = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crm/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crm/contacts"] });
  };
  const takeUser = useMutation({
    mutationFn: (userId: string) =>
      adminFetch(`/api/admin/crm/users/${userId}/take`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: Number(activeAdminId) }),
      }),
    onSuccess: refreshCrm,
  });
  const updateContact = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      adminFetch(`/api/admin/crm/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: refreshCrm,
  });
  const addNote = useMutation({
    mutationFn: (contactId: number) =>
      adminFetch(`/api/admin/crm/contacts/${contactId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      }),
    onSuccess: () => {
      setNote("");
      refreshCrm();
    },
  });
  const importLeads = useMutation({
    mutationFn: (dryRun: boolean) => {
      if (!importFile) throw new Error("Выберите CSV-файл");
      const form = new FormData();
      form.append("file", importFile);
      form.append("source", importSource || "TargetHunter");
      form.append("tags", importTags);
      if (dryRun) form.append("dryRun", "true");
      if (activeAdminId) form.append("ownerId", activeAdminId);
      return adminFetch("/api/admin/crm/import", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (result: {
      created: number;
      skipped: number;
      invalid: number;
      excluded: number;
      dryRun: boolean;
    }) => {
      if (!result.dryRun) {
        refreshCrm();
        setImportOpen(false);
        setImportFile(null);
        setImportPreview(null);
      } else {
        setImportPreview(result);
      }
      toast({
        title: result.dryRun
          ? `Проверка: ${result.created} лидов готовы`
          : `Импортировано: ${result.created}`,
        description: `Дубликатов: ${result.skipped}; неверных строк: ${result.invalid}; исключено: ${result.excluded}`,
      });
    },
    onError: (error: Error) =>
      toast({
        title: "Импорт не выполнен",
        description: error.message,
        variant: "destructive",
      }),
  });
  const sources = useMemo(
    () =>
      Array.from(
        new Set(users.map((user) => user.source || "Без источника")),
      ).sort(),
    [users],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const daysSince = (value: string | null) =>
      value
        ? Math.floor((now - new Date(value).getTime()) / 86_400_000)
        : Infinity;
    const numberPass = (value: number, min: string, max: string) =>
      (!min || value >= Number(min)) && (!max || value <= Number(max));
    return users
      .filter((user) => {
        const searchable = [
          user.id,
          user.name,
          user.phone,
          user.email,
          user.source,
          user.analytics,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (
          filters.search &&
          !searchable.includes(filters.search.toLowerCase())
        )
          return false;
        if (
          filters.source !== "all" &&
          (user.source || "Без источника") !== filters.source
        )
          return false;
        if (
          !numberPass(user.xp, filters.minXp, filters.maxXp) ||
          !numberPass(
            user.walletBalance / 100,
            filters.minBalance,
            filters.maxBalance,
          )
        )
          return false;
        if (
          filters.verified !== "all" &&
          String(user.phoneVerified) !== filters.verified
        )
          return false;
        if (
          filters.firstDiscount !== "all" &&
          String(user.firstOrderDiscountUsed) !== filters.firstDiscount
        )
          return false;
        if (filters.discount === "yes" && user.customDiscount === null)
          return false;
        if (filters.discount === "no" && user.customDiscount !== null)
          return false;
        if (
          filters.analytics &&
          !(user.analytics || "")
            .toLowerCase()
            .includes(filters.analytics.toLowerCase())
        )
          return false;
        const age = daysSince(user.lastXpAccrualAt);
        const xpAccrualTime = user.lastXpAccrualAt
          ? new Date(user.lastXpAccrualAt).getTime()
          : null;
        if (
          (filters.lastXpAccrualFrom || filters.lastXpAccrualTo) &&
          xpAccrualTime === null
        )
          return false;
        if (
          filters.lastXpAccrualFrom &&
          xpAccrualTime! <
            new Date(`${filters.lastXpAccrualFrom}T00:00:00`).getTime()
        )
          return false;
        if (
          filters.lastXpAccrualTo &&
          xpAccrualTime! >
            new Date(`${filters.lastXpAccrualTo}T23:59:59.999`).getTime()
        )
          return false;
        if (filters.xpAccrualAge === "none" && user.lastXpAccrualAt)
          return false;
        if (filters.xpAccrualAge === "has_accrual" && !user.lastXpAccrualAt)
          return false;
        if (filters.xpAccrualAge === "under21" && !(age < 21)) return false;
        if (filters.xpAccrualAge === "over21" && !(age >= 21 && age < 45))
          return false;
        if (
          filters.xpAccrualAge === "over45" &&
          (!user.lastXpAccrualAt || !(age >= 45))
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const aValue =
          sortBy === "lastXpAccrualAt"
            ? a.lastXpAccrualAt
              ? new Date(a.lastXpAccrualAt).getTime()
              : 0
            : a[sortBy];
        const bValue =
          sortBy === "lastXpAccrualAt"
            ? b.lastXpAccrualAt
              ? new Date(b.lastXpAccrualAt).getTime()
              : 0
            : b[sortBy];
        const result =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue || "").localeCompare(String(bValue || ""), "ru");
        return direction === "asc" ? result : -result;
      });
  }, [users, filters, sortBy, direction]);

  const set = (key: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const sourcesForCsv = filtered.reduce(
    (acc, user) => {
      const key = user.source || "Без источника";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const selectedContact = selectedUser
    ? (contacts.find((contact) => contact.userId === selectedUser.id) ?? null)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">База клиентов</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Все аккаунты и их покупки. Пароли не показываются и не фильтруются.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Label className="grid gap-1.5 text-xs text-muted-foreground">
            Работаю как
            <Select
              value={activeAdminId}
              onValueChange={(value) => {
                setActiveAdminId(value);
                sessionStorage.setItem("crmActiveAdminId", value);
              }}
            >
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue placeholder="Выбрать себя" />
              </SelectTrigger>
              <SelectContent>
                {admins
                  .filter((admin) => admin.isActive)
                  .map((admin) => (
                    <SelectItem key={admin.id} value={String(admin.id)}>
                      {admin.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Label>
          <Input
            className="h-9 w-36"
            value={newAdminName}
            onChange={(event) => setNewAdminName(event.target.value)}
            placeholder="Новое имя"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => addAdmin.mutate()}
            disabled={newAdminName.trim().length < 2 || addAdmin.isPending}
            aria-label="Добавить администратора"
          >
            <UserRoundPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Импорт CSV
          </Button>
          <p className="pb-2 text-sm text-muted-foreground">
            Показано: {filtered.length} из {users.length}
          </p>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterInput
            label="Поиск по имени, ID, телефону, email"
            value={filters.search}
            onChange={(value) => set("search", value)}
          />
          <SelectField
            label="Источник"
            value={filters.source}
            onValueChange={(value) => set("source", value)}
            options={[
              { value: "all", label: "Все источники" },
              ...sources.map((source) => ({ value: source, label: source })),
            ]}
          />
          <NumberPair
            label="XP"
            min={filters.minXp}
            max={filters.maxXp}
            onMin={(value) => set("minXp", value)}
            onMax={(value) => set("maxXp", value)}
          />
          <NumberPair
            label="Баланс, руб."
            min={filters.minBalance}
            max={filters.maxBalance}
            onMin={(value) => set("minBalance", value)}
            onMax={(value) => set("maxBalance", value)}
          />
          <SelectField
            label="Телефон подтвержден"
            value={filters.verified}
            onValueChange={(value) => set("verified", value)}
            options={[
              { value: "all", label: "Любой" },
              { value: "true", label: "Да" },
              { value: "false", label: "Нет" },
            ]}
          />
          <SelectField
            label="Персональная скидка"
            value={filters.discount}
            onValueChange={(value) => set("discount", value)}
            options={[
              { value: "all", label: "Любая" },
              { value: "yes", label: "Есть" },
              { value: "no", label: "Нет" },
            ]}
          />
          <SelectField
            label="Использовал первую скидку"
            value={filters.firstDiscount}
            onValueChange={(value) => set("firstDiscount", value)}
            options={[
              { value: "all", label: "Любой" },
              { value: "true", label: "Да" },
              { value: "false", label: "Нет" },
            ]}
          />
          <SelectField
            label="Последнее начисление XP"
            value={filters.xpAccrualAge}
            onValueChange={(value) => set("xpAccrualAge", value)}
            options={[
              { value: "all", label: "Любое время" },
              { value: "has_accrual", label: "Есть начисление" },
              { value: "under21", label: "Менее 21 дня" },
              { value: "over21", label: "21-44 дня назад" },
              { value: "over45", label: "45+ дней назад" },
              { value: "none", label: "Без начислений XP" },
            ]}
          />
          <DatePair
            label="Дата последнего начисления XP"
            from={filters.lastXpAccrualFrom}
            to={filters.lastXpAccrualTo}
            onFrom={(value) => set("lastXpAccrualFrom", value)}
            onTo={(value) => set("lastXpAccrualTo", value)}
          />
          <FilterInput
            label="Аналитика / A-B данные"
            value={filters.analytics}
            onChange={(value) => set("analytics", value)}
          />
          <div className="flex items-end gap-2">
            <SelectField
              label="Сортировка"
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortField)}
              options={[
                { value: "lastXpAccrualAt", label: "Последнее начисление XP" },
                { value: "name", label: "Имя" },
                { value: "phone", label: "Телефон" },
                { value: "email", label: "Email" },
                { value: "xp", label: "XP" },
                { value: "walletBalance", label: "Баланс" },
                { value: "source", label: "Источник" },
                { value: "orderCount", label: "Число покупок" },
                { value: "totalSpent", label: "Сумма покупок" },
              ]}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setDirection((current) => (current === "asc" ? "desc" : "asc"))
              }
              aria-label="Сменить порядок сортировки"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => setFilters(EMPTY)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">
              Загружаем базу...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Клиент</th>
                    <th className="p-3">Контакты</th>
                    <th className="p-3">Источник</th>
                    <th className="p-3 text-right">XP</th>
                    <th className="p-3 text-right">Заказы</th>
                    <th className="p-3">Последнее начисление XP</th>
                    <th className="p-3">В работе</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <p className="font-medium">
                          {user.name || "Без имени"}
                        </p>
                        <p
                          className="max-w-28 truncate text-xs text-muted-foreground"
                          title={user.id}
                        >
                          {user.id}
                        </p>
                      </td>
                      <td className="p-3">
                        <p>{user.phone}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.email || "-"}
                        </p>
                      </td>
                      <td className="p-3">{user.source || "-"}</td>
                      <td className="p-3 text-right">{user.xp}</td>
                      <td className="p-3 text-right">
                        {user.orderCount} ·{" "}
                        {user.totalSpent.toLocaleString("ru-RU")} ₽
                      </td>
                      <td className="p-3">{dateFormat(user.lastXpAccrualAt)}</td>
                      <td className="p-3">
                        {user.ownerName ? (
                          <>
                            <p>{user.ownerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.workStatus === "in_progress"
                                ? "в работе"
                                : user.workStatus}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Не назначен
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant={
                            user.ownerId === Number(activeAdminId)
                              ? "outline"
                              : "default"
                          }
                          disabled={!activeAdminId || takeUser.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            takeUser.mutate(user.id);
                          }}
                        >
                          {user.ownerId === Number(activeAdminId)
                            ? "У меня"
                            : "Взять в работу"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">
                  Подходящих пользователей нет.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Импорт холодных лидов</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Поддерживаются выгрузки TargetHunter: <code>ID</code>,{" "}
              <code>URL</code>, имя и фамилия. Город, возраст, последняя
              активность и доступность личных сообщений сохранятся в карточке.
              Повторная загрузка не создаст дубли.
            </p>
            <Field label="CSV-файл">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportPreview(null);
                }}
              />
            </Field>
            {importFile && (
              <p className="text-xs text-muted-foreground">
                Готов к проверке: {importFile.name} ·{" "}
                {(importFile.size / 1024 / 1024).toFixed(1)} МБ
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Источник">
                <Input
                  value={importSource}
                  onChange={(event) => setImportSource(event.target.value)}
                />
              </Field>
              <Field label="Теги через запятую">
                <Input
                  value={importTags}
                  onChange={(event) => setImportTags(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Сразу назначить">
              <Select
                value={activeAdminId || "unassigned"}
                onValueChange={(value) => {
                  const next = value === "unassigned" ? "" : value;
                  setActiveAdminId(next);
                  next
                    ? sessionStorage.setItem("crmActiveAdminId", next)
                    : sessionStorage.removeItem("crmActiveAdminId");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Не назначать</SelectItem>
                  {admins
                    .filter((admin) => admin.isActive)
                    .map((admin) => (
                      <SelectItem key={admin.id} value={String(admin.id)}>
                        {admin.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            {importPreview && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <p className="font-medium">
                  Файл готов к импорту: {importPreview.created} лидов
                </p>
                <p className="mt-1 text-emerald-900">
                  Дубли: {importPreview.skipped} · неверные строки:{" "}
                  {importPreview.invalid} · исключено: {importPreview.excluded}
                </p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => importLeads.mutate(true)}
                disabled={!importFile || importLeads.isPending}
              >
                {importLeads.isPending ? "Проверяем..." : "Проверить файл"}
              </Button>
              <Button
                onClick={() => importLeads.mutate(false)}
                disabled={!importFile || importLeads.isPending}
              >
                {importLeads.isPending
                  ? "Импортируем..."
                  : "Импортировать лидов"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        {selectedUser && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedUser.name || "Без имени"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p>{selectedUser.phone}</p>
                <p className="text-muted-foreground">
                  {selectedUser.email || "Нет email"} ·{" "}
                  {selectedUser.orderCount} заказов на{" "}
                  {selectedUser.totalSpent.toLocaleString("ru-RU")} ₽
                </p>
              </div>
              {selectedContact ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Статус клиента">
                      <Select
                        value={selectedContact.stage}
                        onValueChange={(stage) =>
                          updateContact.mutate({
                            id: selectedContact.id,
                            body: { stage },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STAGE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Статус работы">
                      <Select
                        value={selectedContact.workStatus}
                        onValueChange={(workStatus) =>
                          updateContact.mutate({
                            id: selectedContact.id,
                            body: { workStatus },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(WORK_STATUS_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Ответственный">
                    <Select
                      value={
                        selectedContact.ownerId
                          ? String(selectedContact.ownerId)
                          : "unassigned"
                      }
                      onValueChange={(value) =>
                        updateContact.mutate({
                          id: selectedContact.id,
                          body:
                            value === "unassigned"
                              ? { ownerId: null, workStatus: "new" }
                              : {
                                  ownerId: Number(value),
                                  workStatus: "in_progress",
                                },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Не назначен</SelectItem>
                        {admins
                          .filter((admin) => admin.isActive)
                          .map((admin) => (
                            <SelectItem key={admin.id} value={String(admin.id)}>
                              {admin.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Заметка</h3>
                    <div className="flex gap-2">
                      <Textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="О чем договорились, что важно клиенту"
                      />
                      <Button
                        size="icon"
                        className="h-10"
                        onClick={() => addNote.mutate(selectedContact.id)}
                        disabled={!note.trim() || addNote.isPending}
                        aria-label="Сохранить заметку"
                      >
                        <StickyNote className="h-4 w-4" />
                      </Button>
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">
                      История работы
                    </h3>
                    <div className="space-y-2">
                      {selectedContact.activities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Заметок пока нет.
                        </p>
                      ) : (
                        selectedContact.activities.map((activity) => (
                          <div
                            key={activity.id}
                            className="border-l-2 border-border pl-3 text-sm"
                          >
                            <p>{activity.body}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {dateFormat(activity.createdAt)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <div className="space-y-3 rounded-md border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">
                    Клиент еще не в работе. Выберите, кто будет с ним работать.
                  </p>
                  <Field label="Ответственный">
                    <Select
                      value={activeAdminId || "choose"}
                      onValueChange={(value) => {
                        if (value !== "choose") {
                          setActiveAdminId(value);
                          sessionStorage.setItem("crmActiveAdminId", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="choose" disabled>
                          Выберите себя
                        </SelectItem>
                        {admins
                          .filter((admin) => admin.isActive)
                          .map((admin) => (
                            <SelectItem key={admin.id} value={String(admin.id)}>
                              {admin.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {admins.length === 0 && (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={newAdminName}
                        onChange={(event) =>
                          setNewAdminName(event.target.value)
                        }
                        placeholder="Ваше имя"
                      />
                      <Button
                        variant="outline"
                        onClick={() => addAdmin.mutate()}
                        disabled={
                          newAdminName.trim().length < 2 || addAdmin.isPending
                        }
                      >
                        Создать себя
                      </Button>
                    </div>
                  )}
                  <Button
                    disabled={!activeAdminId || takeUser.isPending}
                    onClick={() => takeUser.mutate(selectedUser.id)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Взять себе в работу
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
      {Object.keys(sourcesForCsv).length > 0 && (
        <p className="text-xs text-muted-foreground">
          По источникам в выборке:{" "}
          {Object.entries(sourcesForCsv)
            .map(([source, count]) => `${source}: ${count}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" />
        <Input
          className="h-9 pl-8 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Label>
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
    <Label className="grid gap-1.5 text-sm">
      {label}
      {children}
    </Label>
  );
}
function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Label>
  );
}
function NumberPair({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}) {
  return (
    <Label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <div className="grid grid-cols-2 gap-2">
        <Input
          className="h-9 text-sm"
          type="number"
          value={min}
          onChange={(event) => onMin(event.target.value)}
          placeholder="от"
        />
        <Input
          className="h-9 text-sm"
          type="number"
          value={max}
          onChange={(event) => onMax(event.target.value)}
          placeholder="до"
        />
      </div>
    </Label>
  );
}
function DatePair({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <Label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <div className="grid grid-cols-2 gap-2">
        <Input
          className="h-9 text-sm"
          type="date"
          value={from}
          onChange={(event) => onFrom(event.target.value)}
        />
        <Input
          className="h-9 text-sm"
          type="date"
          value={to}
          onChange={(event) => onTo(event.target.value)}
        />
      </div>
    </Label>
  );
}
