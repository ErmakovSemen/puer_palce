import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";

type Item = {
  id: number;
  name: string;
  category: string;
  unit: string;
  price_cents: number;
  quantity: number | null;
  revision: number;
};
type Fetcher = (url: string, options?: RequestInit) => Promise<any>;
const selectClass =
  "h-10 max-w-full rounded-md border bg-background px-3 text-sm";
const rub = (cents: number) =>
  (cents / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
const units = (item: Item) => (item.unit === "piece" ? "шт" : "г");
const json = (data: unknown, method = "POST") => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
type SaleLine = {
  productId: string;
  quantity: string;
  newTeaName: string;
  pricePerGram: string;
};
const emptyLine = (): SaleLine => ({
  productId: "",
  quantity: "",
  newTeaName: "",
  pricePerGram: "",
});
const newTeaValue = "new-tea";
const priceCents = (value: string) =>
  Math.round(Number(value.replace(",", ".")) * 100);
const validPrice = (value: string) =>
  /^\d+([.,]\d{1,2})?$/.test(value) &&
  priceCents(value) > 0 &&
  priceCents(value) <= 10000000;

function saleLineError(lines: SaleLine[], items: Item[]): string | null {
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.productId) return "Выберите товар или «Новый чай».";
    const amount = Number(line.quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000000)
      return "Укажите количество целым числом больше нуля.";
    if (line.productId === newTeaValue) {
      const name = line.newTeaName.trim().replace(/\s+/g, " ");
      if (name.length < 2) return "Введите название нового чая.";
      if (!validPrice(line.pricePerGram))
        return "Укажите цену за 1 г: положительное число, до двух знаков после запятой.";
      if (
        items.some(
          (item) =>
            item.category === "tea" &&
            item.name.toLocaleLowerCase("ru-RU") ===
              name.toLocaleLowerCase("ru-RU"),
        )
      )
        return "Этот чай уже есть в списке. Выберите существующую позицию.";
      const key = `new:${name.toLocaleLowerCase("ru-RU")}`;
      if (seen.has(key)) return "Объедините одинаковые позиции в одну строку.";
      seen.add(key);
      continue;
    }
    const item = items.find((i) => i.id === Number(line.productId));
    if (!item) return "Товар не найден. Обновите страницу.";
    if (item.quantity !== null && amount > item.quantity)
      return `«${item.name}»: доступно ${item.quantity} ${units(item)}.`;
    if (seen.has(line.productId))
      return "Объедините одинаковые позиции в одну строку.";
    seen.add(line.productId);
  }
  return null;
}

function useWarehouse(adminFetch: Fetcher) {
  const qc = useQueryClient();
  const inventory = useQuery<Item[]>({
    queryKey: ["/api/admin/inventory"],
    queryFn: () => adminFetch("/api/admin/inventory"),
  });
  const admins = useQuery<{ id: number; name: string; isActive: boolean }[]>({
    queryKey: ["/api/admin/crm/admins"],
    queryFn: () => adminFetch("/api/admin/crm/admins"),
  });
  const [employee, setEmployee] = useState(
    () => sessionStorage.getItem("crmActiveAdminId") || "",
  );
  useEffect(() => {
    if (!admins.data) return;
    const active = admins.data.filter((admin) => admin.isActive);
    if (active.some((admin) => String(admin.id) === employee)) return;
    const next = active.length === 1 ? String(active[0].id) : "";
    setEmployee(next);
    if (next) sessionStorage.setItem("crmActiveAdminId", next);
    else sessionStorage.removeItem("crmActiveAdminId");
  }, [admins.data, employee]);
  const refresh = () => {
    qc.invalidateQueries();
  };
  const staff = (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      Сотрудник
      <select
        aria-label="Сотрудник"
        className={selectClass}
        value={employee}
        onChange={(e) => {
          setEmployee(e.target.value);
          sessionStorage.setItem("crmActiveAdminId", e.target.value);
        }}
      >
        <option value="">Выберите себя</option>
        {admins.data
          ?.filter((a) => a.isActive)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
    </label>
  );
  return { inventory, employee, staff, refresh };
}

export default function AdminInventory({
  adminFetch,
}: {
  adminFetch: Fetcher;
}) {
  const { inventory, employee, staff, refresh } = useWarehouse(adminFetch);
  const [tab, setTab] = useState("tea"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Item | null>(null);
  const [balance, setBalance] = useState(""),
    [price, setPrice] = useState(""),
    [reason, setReason] = useState(""),
    [offset, setOffset] = useState(0);
  const { toast } = useToast();
  const history = useQuery<any[]>({
    queryKey: ["/api/admin/inventory/movements", offset],
    queryFn: () =>
      adminFetch(`/api/admin/inventory/movements?offset=${offset}`),
    enabled: tab === "history",
  });
  const save = useMutation({
    mutationFn: () =>
      adminFetch(
        `/api/admin/inventory/${editing!.id}`,
        json(
          {
            actorId: Number(employee),
            revision: editing!.revision,
            quantity: Number(balance),
            priceCents: Math.round(Number(price) * 100),
            reason,
          },
          "PATCH",
        ),
      ),
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast({ title: "Склад обновлён" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const rows = (inventory.data || []).filter(
    (i) =>
      i.category === tab && i.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Склад</h2>
        {staff}
        <Button
          variant="outline"
          size="icon"
          aria-label="Обновить склад"
          onClick={() => refresh()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div role="tablist" className="flex gap-2">
        {[
          ["tea", "Чай"],
          ["teaware", "Посуда"],
          ["history", "История"],
        ].map(([id, label]) => (
          <Button
            role="tab"
            aria-selected={tab === id}
            key={id}
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {inventory.isError && (
        <p role="alert">
          Не удалось загрузить склад.{" "}
          <Button onClick={() => inventory.refetch()}>Повторить</Button>
        </p>
      )}
      {inventory.isLoading && <p>Загружаем остатки…</p>}
      {tab !== "history" ? (
        <>
          <Input
            aria-label="Поиск товара"
            placeholder="Найти товар"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="divide-y border-y">
            {rows.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">{i.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {rub(i.price_cents)} / {units(i)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={i.quantity === 0 ? "text-destructive" : ""}>
                    {i.quantity === null
                      ? "Остаток не указан"
                      : `${i.quantity} ${units(i)}`}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(i);
                      setBalance(i.quantity === null ? "" : String(i.quantity));
                      setPrice(String(i.price_cents / 100));
                      setReason("");
                    }}
                  >
                    Изменить
                  </Button>
                </div>
              </div>
            ))}
            {!inventory.isLoading && !rows.length && (
              <p className="py-4">Товаров не найдено.</p>
            )}
          </div>
        </>
      ) : (
        <>
          {history.isError && <p role="alert">Не удалось загрузить историю.</p>}
          {history.data?.map((m) => (
            <div key={m.id} className="border-b py-3 text-sm">
              <p className="font-medium">
                {m.name}:{" "}
                {m.kind === "count"
                  ? "Установлен остаток"
                  : `${m.delta > 0 ? "+" : ""}${m.delta}`}{" "}
                · остаток {m.balance === null ? "не указан" : m.balance}
              </p>
              <p>
                {m.reason} · {m.actor}
              </p>
              <p className="text-muted-foreground">
                {new Date(m.created_at).toLocaleString("ru-RU")} ·{" "}
                {rub(m.price_cents)}
              </p>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button
              aria-label="Предыдущие операции"
              size="icon"
              disabled={!offset}
              onClick={() => setOffset(offset - 50)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              aria-label="Следующие операции"
              size="icon"
              disabled={(history.data?.length || 0) < 50}
              onClick={() => setOffset(offset + 50)}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && !save.isPending && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <label>
            Остаток после операции, {editing && units(editing)}
            <Input
              aria-label="Новый остаток"
              type="number"
              min="0"
              step="1"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </label>
          <label>
            Цена за 1 {editing && units(editing)}, ₽
            <Input
              aria-label="Цена за единицу"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Причина
            <Input
              placeholder="Приход, пересчёт, бой…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {staff}
          <Button
            disabled={
              !employee ||
              !balance ||
              !price ||
              reason.trim().length < 2 ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            <Save className="mr-2 h-4 w-4" />
            Сохранить
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// Reuses the customer selected on the existing XP screen; null means an explicit guest sale.
export function InventorySale({
  adminPassword,
  customer,
  onChanged,
}: {
  adminPassword: string;
  customer?: { id: string; name: string | null; phone: string } | null;
  onChanged?: () => void;
}) {
  const adminFetch: Fetcher = async (url, options = {}) => {
    const res = await fetch(getApiUrl(url), {
      ...options,
      headers: { ...options.headers, "X-Admin-Password": adminPassword },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Ошибка сохранения");
    return body;
  };
  const { inventory, employee, staff, refresh } = useWarehouse(adminFetch);
  const [buyerMode, setBuyerMode] = useState<"auto" | "customer" | "guest">(
      "auto",
    ),
    [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [showValidation, setShowValidation] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [receipt, setReceipt] = useState<any>(null),
    [locked, setLocked] = useState(false),
    [pendingPayload, setPendingPayload] = useState<any>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const { toast } = useToast();
  const sales = useQuery<any[]>({
    queryKey: ["/api/admin/inventory/sales"],
    queryFn: () => adminFetch("/api/admin/inventory/sales"),
  });
  const items = inventory.data || [];
  const total = lines.reduce(
    (sum, l) =>
      sum +
      (l.productId === newTeaValue
        ? validPrice(l.pricePerGram)
          ? priceCents(l.pricePerGram)
          : 0
        : items.find((i) => i.id === Number(l.productId))?.price_cents || 0) *
        Number(l.quantity),
    0,
  );
  const anonymous =
    buyerMode === "guest" || (buyerMode === "auto" && !customer);
  const buyer = anonymous ? null : customer;
  const settings = useQuery<{ xpMultiplier?: number }>({
    queryKey: ["/api/settings"],
    queryFn: () => adminFetch("/api/settings"),
  });
  const validationError = !employee
    ? "Выберите сотрудника перед продажей."
    : !anonymous && !customer
      ? "Выберите клиента в поиске ниже или отметьте анонимного покупателя."
      : inventory.isError
        ? "Не удалось загрузить товары. Обновите страницу."
        : saleLineError(lines, items);
  const submit = useMutation({
    mutationFn: (payload: any) =>
      adminFetch("/api/admin/inventory/sales", json(payload)),
    onSuccess: (r) => {
      setReceipt(r);
      setLines([emptyLine()]);
      setRequestId(crypto.randomUUID());
      setPendingPayload(null);
      setLocked(false);
      setShowValidation(false);
      refresh();
      onChanged?.();
    },
    onError: (e: Error) =>
      toast({
        title: e.message,
        description:
          "Повторить можно той же кнопкой. Повторный запрос не создаст вторую продажу.",
        variant: "destructive",
      }),
  });
  const cancel = useMutation({
    mutationFn: (id: number) =>
      adminFetch(
        `/api/admin/inventory/sales/${id}/cancel`,
        json({ actorId: Number(employee) }),
      ),
    onSuccess: () => {
      setCancelId(null);
      refresh();
      onChanged?.();
      toast({ title: "Продажа отменена, товар возвращён на склад" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  return (
    <section className="space-y-4 border-y py-5">
      <h3 className="text-xl font-semibold">Продажа и начисление XP</h3>
      {staff}
      <fieldset disabled={locked} className="space-y-3">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!anonymous}
              onChange={() => setBuyerMode("customer")}
            />
            Выбранный клиент
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={anonymous}
              onChange={() => setBuyerMode("guest")}
            />
            Анонимный покупатель
          </label>
        </div>
        <p className="text-sm">
          {anonymous
            ? "Без начисления XP"
            : customer
              ? `${customer.name || "Клиент"} · ${customer.phone}`
              : "Выберите клиента в поиске ниже"}
        </p>
        {inventory.isError && <p role="alert">Не удалось загрузить товары.</p>}
        {lines.map((line, index) => {
          const item = items.find((i) => i.id === Number(line.productId));
          return (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_6rem_2.5rem] gap-2"
            >
              <select
                aria-label={`Товар ${index + 1}`}
                className={`${selectClass} col-span-3 w-full sm:col-span-1`}
                value={line.productId}
                onChange={(e) =>
                  setLines(
                    lines.map((l, n) =>
                      n === index ? { ...l, productId: e.target.value } : l,
                    ),
                  )
                }
              >
                <option value="">Выберите чай или посуду</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {rub(i.price_cents)}/{units(i)} ·{" "}
                    {i.quantity === null
                      ? "остаток не указан"
                      : `остаток ${i.quantity}`}
                  </option>
                ))}
                <option value={newTeaValue}>Новый чай</option>
              </select>
              {line.productId === newTeaValue && (
                <div className="col-span-3 grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label={`Название нового чая ${index + 1}`}
                    placeholder="Название чая"
                    maxLength={180}
                    value={line.newTeaName}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, n) =>
                          n === index
                            ? { ...l, newTeaName: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Цена нового чая за грамм ${index + 1}`}
                    placeholder="Цена за 1 г, ₽"
                    inputMode="decimal"
                    value={line.pricePerGram}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, n) =>
                          n === index
                            ? { ...l, pricePerGram: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Остаток пока неизвестен. Чай появится на складе после
                    продажи.
                  </p>
                </div>
              )}
              <Input
                aria-label={`Количество ${index + 1}`}
                type="number"
                min="1"
                step="1"
                placeholder={item ? units(item) : "Вес/шт"}
                value={line.quantity}
                onChange={(e) =>
                  setLines(
                    lines.map((l, n) =>
                      n === index ? { ...l, quantity: e.target.value } : l,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Удалить позицию ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, n) => n !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {item && (
                <p className="col-span-3 text-xs text-muted-foreground">
                  {item.quantity === null
                    ? "Остаток не указан"
                    : `${item.quantity} ${units(item)} в наличии`}{" "}
                  · {rub(item.price_cents)} за 1 {units(item)}
                </p>
              )}
            </div>
          );
        })}
        {lines.some((line) => line.productId) && (
          <Button
            variant="outline"
            disabled={lines.length >= 50}
            onClick={() => setLines([...lines, emptyLine()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ещё товар
          </Button>
        )}
      </fieldset>
      <p className="font-semibold">
        Итого: {rub(total)} ·{" "}
        {buyer
          ? Math.floor((total / 100) * (settings.data?.xpMultiplier ?? 1))
          : 0}{" "}
        XP
      </p>
      {showValidation && validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}
      {locked && submit.error instanceof Error && (
        <p role="alert" className="text-sm text-destructive">
          {submit.error.message}
        </p>
      )}
      <Button
        disabled={submit.isPending}
        onClick={() => {
          setShowValidation(true);
          if (!locked && validationError) return;
          const payload = pendingPayload || {
            requestId,
            actorId: Number(employee),
            userId: buyer?.id || null,
            lines: lines.map((l) =>
              l.productId === newTeaValue
                ? {
                    newTeaName: l.newTeaName.trim().replace(/\s+/g, " "),
                    quantity: Number(l.quantity),
                    priceCents: priceCents(l.pricePerGram),
                  }
                : {
                    productId: Number(l.productId),
                    quantity: Number(l.quantity),
                    priceCents: items.find((i) => i.id === Number(l.productId))!
                      .price_cents,
                  },
            ),
          };
          setLocked(true);
          setPendingPayload(payload);
          submit.mutate(payload);
        }}
      >
        {submit.isPending
          ? "Сохраняем…"
          : locked
            ? "Повторить подтверждение"
            : "Подтвердить продажу"}
      </Button>
      {locked && !submit.isPending && (
        <Button
          variant="outline"
          onClick={() => {
            setLocked(false);
            setPendingPayload(null);
            inventory.refetch();
          }}
        >
          Исправить данные
        </Button>
      )}
      {receipt && (
        <p role="status">
          Продажа №{receipt.id}: {rub(receipt.total_cents)}, начислено{" "}
          {receipt.xp} XP.
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Последние 100 продаж
        </summary>
        {sales.data?.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm"
          >
            <div>
              №{s.id} · {s.buyer} · {rub(s.total_cents)}
              <p className="text-xs text-muted-foreground">
                {s.lines
                  .map((l: any) => `${l.name}: ${l.quantity} ${l.unit}`)
                  .join(", ")}{" "}
                · {s.actor}
              </p>
            </div>
            {s.status === "cancelled" ? (
              <span>Отменена</span>
            ) : (
              <Button
                variant="outline"
                disabled={!employee || cancel.isPending}
                onClick={() => setCancelId(s.id)}
              >
                Отменить продажу
              </Button>
            )}
          </div>
        ))}
      </details>
      <Dialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && !cancel.isPending && setCancelId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить продажу №{cancelId}?</DialogTitle>
          </DialogHeader>
          <p>
            Товары вернутся на склад, начисленные XP будут списаны с учётом
            доступного баланса клиента.
          </p>
          <Button
            disabled={cancel.isPending}
            onClick={() => cancelId && cancel.mutate(cancelId)}
          >
            Подтвердить отмену
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
