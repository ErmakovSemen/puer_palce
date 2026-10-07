import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ChevronsUpDown,
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
import { getLoyaltyDiscountFromSettings } from "@shared/pricing";
import { calculateInventoryPrice } from "@shared/inventory-pricing";
import { getTeaTypeColor } from "@/lib/tea-colors";
import { useTeaTypes } from "@/hooks/use-tea-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Item = {
  id: number;
  name: string;
  category: string;
  tea_type?: string | null;
  description?: string;
  inventory_archived?: boolean;
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
  saleFormat: "loose" | "teapot" | "ceremony" | "cup";
  servicePrice: string;
};
const emptyLine = (): SaleLine => ({
  productId: "",
  quantity: "",
  newTeaName: "",
  pricePerGram: "",
  saleFormat: "loose",
  servicePrice: "",
});
const newTeaValue = "new-tea";
const priceCents = (value: string) =>
  Math.round(Number(value.replace(",", ".")) * 100);
const validPrice = (value: string) =>
  /^\d+([.,]\d{1,2})?$/.test(value) &&
  priceCents(value) > 0 &&
  priceCents(value) <= 10000000;
const validServicePrice = (value: string) =>
  /^\d+([.,]\d{1,2})?$/.test(value) &&
  priceCents(value) >= 0 && priceCents(value) <= 10000000;

export const filledSaleLines = (lines: SaleLine[]) =>
  lines.filter((line) =>
    [line.productId, line.quantity, line.newTeaName, line.pricePerGram].some(
      (value) => value.trim() !== "",
    ) || line.saleFormat !== "loose",
  );

export function saleLineError(lines: SaleLine[], items: Item[]): string | null {
  if (!lines.length) return "Добавьте чай или посуду.";
  const newNames = new Set<string>();
  const reserved = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) return "Выберите товар или «Новый чай».";
    if (line.saleFormat !== "loose" && !validServicePrice(line.servicePrice))
      return `«${items.find((item) => item.id === Number(line.productId))?.name || line.newTeaName || "Чай"}»: укажите цену справа от количества. Для бесплатного списания выберите 0 ₽.`;
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
      if (newNames.has(key)) return "Новый чай с таким названием уже есть в чеке.";
      newNames.add(key);
      continue;
    }
    const item = items.find((i) => i.id === Number(line.productId));
    if (!item) return "Товар не найден. Обновите страницу.";
    if (line.saleFormat !== "loose" && item.category !== "tea")
      return "Для чайника, церемонии или кружки выберите чай.";
    if (line.pricePerGram && !validPrice(line.pricePerGram))
      return "Проверьте цену товара: положительное число до двух знаков после запятой.";
    const used = (reserved.get(line.productId) || 0) + amount;
    if (item.quantity !== null && used > item.quantity)
      return `«${item.name}»: доступно ${item.quantity} ${units(item)} на все позиции.`;
    reserved.set(line.productId, used);
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
  const [description, setDescription] = useState("");
  const [teaType, setTeaType] = useState("");
  const [archived, setArchived] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { data: availableTypes } = useTeaTypes();
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
            quantity: balance === "" && editing!.category === "tea" ? null : Number(balance),
            priceCents: Math.round(Number(price) * 100),
            reason,
            description, teaType: teaType || null, archived,
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
      i.category === tab && (showArchived || !i.inventory_archived) && i.name.toLowerCase().includes(search.toLowerCase()),
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
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Показать убранные товары</label>
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
                      setDescription(i.description || "");
                      setTeaType(i.tea_type || "");
                      setArchived(!!i.inventory_archived);
                      setBalance(i.quantity === null ? "" : String(i.quantity));
                      setPrice(String(i.price_cents / 100));
                      setReason("Изменение карточки и остатков");
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
              {m.sale_total_cents != null && <p>Итог продажи: {rub(m.sale_total_cents)}</p>}
              {m.price_changes?.map((change: any) => <p key={change.id}>{change.comment} · {change.actor}</p>)}
              {m.sale_comment && <p>Комментарий: {m.sale_comment}</p>}
              {m.before_state && <details><summary className="cursor-pointer">Изменения карточки</summary><p>Тип: {m.before_state.teaType || "—"} → {m.after_state.teaType || "—"}</p><p>Описание: {m.before_state.description || "—"} → {m.after_state.description || "—"}</p><p>Доступность: {m.before_state.archived ? "убран" : "доступен"} → {m.after_state.archived ? "убран" : "доступен"}</p></details>}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          {editing?.category === "tea" && <>
            <label className="text-sm">Описание<textarea className="w-full rounded-md border bg-background p-2" rows={3} maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="text-sm">Тип чая<Input list="inventory-tea-types" maxLength={100} value={teaType} onChange={(event) => setTeaType(event.target.value)} /><datalist id="inventory-tea-types">{availableTypes?.map((type) => <option key={type.name} value={type.name} />)}</datalist></label>
          </>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Убрать из доступных товаров</label>
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
              (balance === "" && editing?.category !== "tea") ||
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

export function InventorySale({
  adminPassword,
  buyerMode,
  customer,
  onBusyChange,
  onChanged,
}: {
  adminPassword: string;
  buyerMode: "guest" | "customer";
  customer?: { id: string; name: string | null; phone: string; xp?: number; phoneVerified?: boolean; customDiscount?: number | null; offlineSignupBonusAvailable?: boolean; firstOrderDiscountUsed?: boolean } | null;
  onBusyChange?: (busy: boolean) => void;
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
  const { data: teaTypePalette } = useTeaTypes();
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [customerDiscount, setCustomerDiscount] = useState("");
  const [extraDiscount, setExtraDiscount] = useState("0");
  const [extraRubles, setExtraRubles] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [comment, setComment] = useState("");
  const [bonusKind, setBonusKind] = useState<"gift" | "discount" | "">("");
  const [giftProductId, setGiftProductId] = useState("");
  const [giftQuantity, setGiftQuantity] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState<number | null>(null);
  const [openPriceIndex, setOpenPriceIndex] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [teaTypeFilter, setTeaTypeFilter] = useState<string | null>(null);
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
  const items = (inventory.data || []).filter((item) => !item.inventory_archived);
  const teaTypes = Array.from(new Set(items.filter((item) => item.category === "tea" && item.tea_type).map((item) => item.tea_type!))).sort((a, b) => a.localeCompare(b, "ru-RU"));
  const teaTypeColor = (type: string) => teaTypePalette?.find((entry) => entry.name === type)?.backgroundColor || getTeaTypeColor(type);
  const saleLines = filledSaleLines(lines);
  const subtotal = saleLines.reduce(
    (sum, l) =>
      sum + (!l.productId || !Number(l.quantity) ? 0 : l.saleFormat !== "loose" ? validServicePrice(l.servicePrice) ? priceCents(l.servicePrice) : 0 :
      (l.productId === newTeaValue
        ? validPrice(l.pricePerGram)
          ? priceCents(l.pricePerGram)
          : 0
        : l.pricePerGram && validPrice(l.pricePerGram) ? priceCents(l.pricePerGram) : items.find((i) => i.id === Number(l.productId))?.price_cents || 0) *
        Number(l.quantity)),
    0,
  );
  const anonymous = buyerMode === "guest";
  const buyer = anonymous ? null : customer;
  const bonusAvailable = !!buyer?.offlineSignupBonusAvailable && !buyer.firstOrderDiscountUsed;
  useEffect(() => {
    setCustomerDiscount("");
    setBonusKind("");
    setGiftProductId("");
    setGiftQuantity("");
  }, [buyer?.id]);
  const settings = useQuery<{ xpMultiplier?: number; loyaltyLevel2MinXP?: number; loyaltyLevel2Discount?: number; loyaltyLevel3MinXP?: number; loyaltyLevel3Discount?: number; loyaltyLevel4MinXP?: number; loyaltyLevel4Discount?: number }>({
    queryKey: ["/api/settings"],
    queryFn: () => adminFetch("/api/settings"),
  });
  const baseDiscount = bonusAvailable && bonusKind === "discount"
    ? 20
    : buyer?.customDiscount ?? (buyer
      ? getLoyaltyDiscountFromSettings(buyer.xp || 0, settings.data) : 0);
  const appliedDiscount = bonusKind === "discount" && bonusAvailable
    ? 20 : customerDiscount === "" ? baseDiscount : Number(customerDiscount);
  const pricing = calculateInventoryPrice(subtotal, appliedDiscount, Number(extraDiscount || 0), priceCents(extraRubles || "0"), finalPrice === "" ? undefined : priceCents(finalPrice));
  const total = pricing.total;
  const discountAmount = subtotal - total;
  const giftItem = items.find((item) => item.id === Number(giftProductId));
  const giftSoldQuantity = saleLines.filter((line) => line.productId === giftProductId).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const validationError = !employee
    ? "Выберите сотрудника перед продажей."
    : !anonymous && !customer
      ? "Выберите или создайте клиента выше."
      : inventory.isError
        ? "Не удалось загрузить товары. Обновите страницу."
        : (extraRubles !== "" && !validServicePrice(extraRubles)) || (finalPrice !== "" && !validServicePrice(finalPrice))
          ? "Укажите сумму в рублях от 0, до двух знаков после запятой."
        : priceCents(extraRubles || "0") > pricing.afterPercent
          ? "Дополнительная скидка больше суммы после скидки клиента."
        : !Number.isInteger(appliedDiscount) || appliedDiscount < 0 || appliedDiscount > 100 ||
          !Number.isInteger(Number(extraDiscount)) || Number(extraDiscount) < 0 || Number(extraDiscount) > 100
          ? "Скидки должны быть целыми процентами от 0 до 100."
        : bonusAvailable && !bonusKind
          ? "Выберите бонус новому клиенту: подарок или скидку."
        : bonusKind === "gift" && (!giftProductId || !Number.isInteger(Number(giftQuantity)) || Number(giftQuantity) < 1)
          ? "Выберите подарочный чай и укажите граммовку."
        : bonusKind === "gift" && giftItem?.quantity !== null && giftItem?.quantity !== undefined && Number(giftQuantity) + giftSoldQuantity > giftItem.quantity
          ? `Недостаточно чая «${giftItem.name}» для продажи и подарка.`
        : saleLineError(saleLines, items);
  const submit = useMutation({
    mutationFn: (payload: any) =>
      adminFetch("/api/admin/inventory/sales", json(payload)),
    onSuccess: (r) => {
      setReceipt(r);
      setLines([emptyLine()]);
      setCustomerDiscount("");
      setExtraDiscount("0");
      setExtraRubles(""); setFinalPrice(""); setComment("");
      setBonusKind("");
      setGiftProductId("");
      setGiftQuantity("");
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
  useEffect(() => {
    onBusyChange?.(locked || submit.isPending);
  }, [locked, submit.isPending, onBusyChange]);
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
    <section className="max-w-4xl space-y-3 border-t py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Продажа{!anonymous && " · XP"}</h3>
        {staff}
      </div>
      <fieldset disabled={locked} className="space-y-2">
        {inventory.isError && <p role="alert" className="flex items-center gap-2 text-sm text-destructive">Не удалось загрузить товары. <Button type="button" size="sm" variant="outline" onClick={() => inventory.refetch()}>Повторить</Button></p>}
        {lines.map((line, index) => {
          const item = items.find((i) => i.id === Number(line.productId));
          const matches = items.filter((candidate) =>
            (line.saleFormat === "loose" || candidate.category === "tea") &&
            (!teaTypeFilter || (candidate.category === "tea" && candidate.tea_type === teaTypeFilter)) &&
            candidate.name.toLocaleLowerCase("ru-RU").includes(productSearch.trim().toLocaleLowerCase("ru-RU")));
          return (
            <div
              key={index}
              className="flex flex-wrap items-start gap-2 border-b border-border/70 py-2 last:border-b-0"
            >
              <select
                aria-label={`Формат позиции ${index + 1}`}
                className={`${selectClass} w-36 shrink-0`}
                value={line.saleFormat}
                onChange={(e) => {
                  const format = e.target.value as SaleLine["saleFormat"];
                  setLines(lines.map((current, n) => n === index ? {
                    ...current,
                    saleFormat: format,
                    servicePrice: format === "cup" ? "300" : format === "teapot" ? "450" : format === "ceremony" ? "850" : "",
                    productId: format !== "loose" && item?.category !== "tea" ? "" : current.productId,
                  } : current));
                }}
              >
                <option value="loose">Рассыпной</option>
                <option value="teapot">Чайник</option>
                <option value="ceremony">Церемония</option>
                <option value="cup">Кружка с собой</option>
              </select>
              <div className="min-w-0 flex-[1_1_14rem]">
              <Popover
                open={openProductIndex === index}
                onOpenChange={(open) => {
                  setOpenProductIndex(open ? index : null);
                  setProductSearch("");
                  setTeaTypeFilter(null);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-label={`Товар ${index + 1}`}
                    aria-expanded={openProductIndex === index}
                    title={item ? `${item.name} · ${item.quantity === null ? "остаток не указан" : `${item.quantity} ${units(item)} в наличии`}` : undefined}
                    className="h-10 w-full min-w-0 justify-between font-normal"
                  >
                    <span className="truncate text-left">
                      {line.productId === newTeaValue
                        ? line.newTeaName || "Новый чай"
                        : item?.name || (line.saleFormat === "loose" ? "Выберите товар" : "Выберите чай")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={line.saleFormat === "loose" ? "Найти чай или посуду" : "Найти чай"}
                      value={productSearch}
                      onValueChange={setProductSearch}
                      autoFocus
                    />
                    {!!teaTypes.length && <div role="group" aria-label="Фильтр по типу чая" className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
                      <button type="button" aria-label="Все типы чая" title="Все типы чая" aria-pressed={!teaTypeFilter}
                        className={`h-5 rounded-full border px-1.5 text-xs ${!teaTypeFilter ? "border-foreground font-semibold" : "border-border text-muted-foreground"}`}
                        onClick={() => setTeaTypeFilter(null)}>Все</button>
                      {teaTypes.map((type) => <button key={type} type="button" aria-label={`Тип: ${type}`} title={type} aria-pressed={teaTypeFilter === type}
                        className={`h-5 w-5 rounded-full border-2 ${teaTypeFilter === type ? "border-foreground ring-2 ring-offset-1" : "border-transparent"}`}
                        style={{ backgroundColor: teaTypeColor(type) }}
                        onClick={() => setTeaTypeFilter(teaTypeFilter === type ? null : type)} />)}
                    </div>}
                    <CommandList className="max-h-[min(20rem,50vh)] overflow-y-auto">
                      {inventory.isLoading && <p className="px-3 py-3 text-sm text-muted-foreground">Загружаем товары…</p>}
                      {inventory.isError && <div className="flex items-center justify-between gap-2 px-3 py-3 text-sm text-destructive">
                        <span>Товары недоступны</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => inventory.refetch()}>Повторить</Button>
                      </div>}
                      <CommandGroup>
                        {!inventory.isLoading && !inventory.isError && !matches.length && <p className="px-2 py-3 text-sm text-muted-foreground">Подходящих товаров нет</p>}
                        {!inventory.isLoading && !inventory.isError && matches.map((i) => (
                          <CommandItem
                            key={i.id}
                            value={`${i.name} ${i.category} ${i.id}`}
                            title={i.name}
                            onSelect={() => {
                              setLines((current) =>
                                current.map((l, n) =>
                                  n === index ? { ...l, productId: String(i.id), newTeaName: "", pricePerGram: String(i.price_cents / 100) } : l,
                                ),
                              );
                              setOpenProductIndex(null);
                              setProductSearch("");
                            }}
                          >
                            {i.category === "tea" && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: teaTypeColor(i.tea_type || "") }} />}
                            <span className="min-w-0 flex-1 truncate">{i.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {rub(i.price_cents)}/{units(i)}
                            </span>
                          </CommandItem>
                        ))}
                        {!inventory.isLoading && !inventory.isError && <CommandItem
                          value="new-tea"
                          onSelect={() => {
                            setLines((current) => current.map((l, n) => n === index
                              ? { ...l, productId: newTeaValue, newTeaName: productSearch.trim() || l.newTeaName, pricePerGram: "" }
                              : l));
                            setOpenProductIndex(null);
                            setProductSearch("");
                          }}
                        ><Plus className="h-4 w-4" /> Новый чай</CommandItem>}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
              <Input
                aria-label={`Количество ${index + 1}`}
                type="number"
                min="1"
                step="1"
                placeholder={item ? units(item) : "г/шт"}
                className="w-20 shrink-0"
                value={line.quantity}
                onChange={(e) => setLines(lines.map((l, n) => n === index ? { ...l, quantity: e.target.value } : l))}
              />
              {line.saleFormat !== "loose" && (
                <Popover open={openPriceIndex === index} onOpenChange={(open) => setOpenPriceIndex(open ? index : null)}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-label={`Цена позиции ${index + 1}`}
                      aria-expanded={openPriceIndex === index} className="h-10 w-24 shrink-0 justify-between px-2 font-normal">
                      <span className="truncate">{line.servicePrice || "Цена"} ₽</span><ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 space-y-1 p-2" align="start">
                    <Input aria-label={`Своя цена позиции ${index + 1}`} inputMode="decimal" placeholder="Своя цена, ₽" autoFocus
                      value={line.servicePrice} onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setLines((current) => current.map((l, n) => n === index ? { ...l, servicePrice: e.target.value } : l))}
                      onKeyDown={(e) => { if (e.key === "Enter" && validServicePrice(line.servicePrice)) setOpenPriceIndex(null); }} />
                    {(line.saleFormat === "teapot" ? [450, 550, 650, 700] : line.saleFormat === "ceremony" ? [850, 950] : [300]).map((value) =>
                      <Button key={value} type="button" variant={line.servicePrice === String(value) ? "secondary" : "ghost"}
                        size="sm" className="w-full justify-start" onClick={() => {
                          setLines((current) => current.map((l, n) => n === index ? { ...l, servicePrice: String(value) } : l));
                          setOpenPriceIndex(null);
                        }}>{value} ₽</Button>)}
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => {
                      setLines((current) => current.map((l, n) => n === index ? { ...l, servicePrice: "0" } : l));
                      setOpenPriceIndex(null);
                    }}>0 ₽ · бесплатно</Button>
                  </PopoverContent>
                </Popover>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Удалить позицию ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => {
                  setLines(lines.filter((_, n) => n !== index));
                  setOpenProductIndex(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {line.productId === newTeaValue && (
                <div className="flex w-full flex-wrap gap-2 pl-1">
                  <Input
                    aria-label={`Название нового чая ${index + 1}`}
                    placeholder="Название чая"
                    className="min-w-44 flex-1"
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
                    className="w-32"
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
                </div>
              )}
              {item && line.saleFormat === "loose" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Цена/{units(item)}, ₽
                  <Input aria-label={`Цена за единицу ${index + 1}`} inputMode="decimal" className="h-8 w-24"
                    value={line.pricePerGram || String(item.price_cents / 100)}
                    onChange={(e) => setLines(lines.map((l, n) => n === index ? { ...l, pricePerGram: e.target.value } : l))} />
                </label>
              )}
            </div>
          );
        })}
        {lines.some((line) => line.productId) && (
          <Button
            variant="outline"
            disabled={lines.length >= 50}
            onClick={() => {
              setProductSearch("");
              const emptyIndex = lines.findIndex(
                (line) => !filledSaleLines([line]).length,
              );
              if (emptyIndex < 0) {
                setLines([...lines, emptyLine()]);
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ещё товар
          </Button>
        )}
      </fieldset>
      {bonusAvailable && (
        <div className="space-y-2 border-y py-3">
          <p className="font-medium">Бонус за регистрацию: выбор клиента</p>
          <div className="flex gap-2">
            <Button type="button" variant={bonusKind === "gift" ? "default" : "outline"} onClick={() => setBonusKind("gift")}>Чай в подарок</Button>
            <Button type="button" variant={bonusKind === "discount" ? "default" : "outline"} onClick={() => setBonusKind("discount")}>Скидка 20%</Button>
          </div>
          {bonusKind === "gift" && <div className="flex flex-wrap gap-2">
            <select aria-label="Подарочный чай" className={selectClass} value={giftProductId} onChange={(e) => setGiftProductId(e.target.value)}>
              <option value="">Выберите подарочный чай</option>
              {items.filter((item) => item.category === "tea").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <Input aria-label="Граммы подарочного чая" type="number" min="1" step="1" placeholder="Граммы" className="w-28" value={giftQuantity} onChange={(e) => setGiftQuantity(e.target.value)} />
          </div>}
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Настроить скидки</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {buyer && <label className="text-sm">Скидка клиента, %
          <Input type="number" min="0" max="100" step="1" value={bonusKind === "discount" ? "20" : customerDiscount}
            placeholder={String(baseDiscount)} disabled={bonusKind === "discount"} onChange={(e) => setCustomerDiscount(e.target.value)} />
        </label>}
        <label className="text-sm">Дополнительная скидка, %
          <Input type="number" min="0" max="100" step="1" value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} />
        </label>
        <label className="text-sm">Дополнительная скидка, ₽<Input inputMode="decimal" placeholder="0" value={extraRubles} onChange={(event) => setExtraRubles(event.target.value)} /></label>
        <label className="text-sm">Итог вручную, ₽<Input inputMode="decimal" placeholder={String(pricing.calculatedTotal / 100)} value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} /></label>
      </div>
      </details>
      <label className="block text-sm">Комментарий к покупке<Input maxLength={2000} placeholder="Необязательно" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className="text-sm">
        <p>Цена: {rub(subtotal)} · {discountAmount >= 0 ? `скидка: −${rub(discountAmount)}` : `надбавка: +${rub(-discountAmount)}`}</p>
        <p>По расчёту: {rub(pricing.calculatedTotal)}</p>
        <p className="font-semibold">Покупатель заплатит: {rub(total)}{buyer && ` · ${Math.floor((total / 100) * (settings.data?.xpMultiplier ?? 1))} XP`}</p>
      </div>
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
            customerDiscountPercent: buyer && bonusKind !== "discount" && customerDiscount !== "" ? Number(customerDiscount) : undefined,
            extraDiscountPercent: Number(extraDiscount),
            extraDiscountCents: priceCents(extraRubles || "0"),
            finalPriceCents: finalPrice === "" ? undefined : priceCents(finalPrice),
            comment,
            bonusKind: bonusAvailable ? bonusKind || null : null,
            gift: bonusKind === "gift" ? { productId: Number(giftProductId), quantity: Number(giftQuantity) } : null,
            lines: saleLines.map((l) =>
              l.productId === newTeaValue
                ? {
                    newTeaName: l.newTeaName.trim().replace(/\s+/g, " "),
                    quantity: Number(l.quantity),
                    priceCents: priceCents(l.pricePerGram),
                    saleFormat: l.saleFormat,
                    servicePriceCents: l.saleFormat === "loose" ? undefined : priceCents(l.servicePrice),
                  }
                : {
                    productId: Number(l.productId),
                    quantity: Number(l.quantity),
                    priceCents: l.saleFormat === "loose" ? priceCents(l.pricePerGram || String(items.find((i) => i.id === Number(l.productId))!.price_cents / 100)) : items.find((i) => i.id === Number(l.productId))!.price_cents,
                    priceOverride: l.saleFormat === "loose" && priceCents(l.pricePerGram || String(items.find((i) => i.id === Number(l.productId))!.price_cents / 100)) !== items.find((i) => i.id === Number(l.productId))!.price_cents,
                    saleFormat: l.saleFormat,
                    servicePriceCents: l.saleFormat === "loose" ? undefined : priceCents(l.servicePrice),
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
          Продажа №{receipt.id}: {rub(receipt.total_cents)}
          {receipt.xp > 0 ? `, начислено ${receipt.xp} XP` : ""}.
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
