import { useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Fetcher = (url: string, options?: RequestInit) => Promise<any>;
type SaleLine = { productId: number; name: string; quantity: number; priceCents: number; unit: string };
type Sale = {
  id: number; user_id: string | null; buyer: string; actor: string; lines: SaleLine[];
  total_cents: number; subtotal_cents: number; discount_cents: number;
  discount_percent: number; extra_discount_percent: number; xp: number;
  sale_format: "loose" | "teapot" | "ceremony" | "cup"; bonus_kind: "gift" | "discount" | null;
  gift: { productId: number; quantity: number; name: string } | null;
  status: string; created_at: string;
};
type Product = { id: number; name: string; category: string; price_cents: number; quantity: number | null; unit: string };
type EditLine = { productId: string; quantity: string; price: string };
const formatNames: Record<string, string> = { loose: "Рассыпной", teapot: "Чайник", ceremony: "Церемония", cup: "Кружка" };
const money = (cents: number) => (cents / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
const moscowDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const changeDay = (day: string, step: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + step);
  return date.toISOString().slice(0, 10);
};
const moscowDateTime = (value: string) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(value)).replace(" ", "T");

export default function AdminSalesLedger({ adminFetch }: { adminFetch: Fetcher }) {
  const [date, setDate] = useState(moscowDate);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [format, setFormat] = useState<Sale["sale_format"]>("loose");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [extraDiscount, setExtraDiscount] = useState("0");
  const [bonusKind, setBonusKind] = useState<"" | "gift" | "discount">("");
  const [giftProductId, setGiftProductId] = useState("");
  const [giftQuantity, setGiftQuantity] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [actorId, setActorId] = useState(() => sessionStorage.getItem("crmActiveAdminId") || "");
  const [correctionRequestId, setCorrectionRequestId] = useState(() => crypto.randomUUID());
  const editSubtotal = format === "loose"
    ? lines.reduce((sum, line) => sum + (Number(line.price.replace(",", ".")) || 0) * 100 * (Number(line.quantity) || 0), 0)
    : (Number(price.replace(",", ".")) || 0) * 100;
  const editCustomerDiscount = bonusKind === "discount" ? 20 : Number(discount) || 0;
  const editTotal = Math.round(Math.round(editSubtotal * (100 - editCustomerDiscount) / 100) * (100 - (Number(extraDiscount) || 0)) / 100);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sales = useQuery<Sale[]>({
    queryKey: ["/api/admin/inventory/sales", date, search, offset],
    queryFn: () => adminFetch(`/api/admin/inventory/sales?date=${date}&search=${encodeURIComponent(search)}&offset=${offset}`),
  });
  const products = useQuery<Product[]>({ queryKey: ["/api/admin/inventory"], queryFn: () => adminFetch("/api/admin/inventory") });
  const admins = useQuery<{ id: number; name: string; isActive: boolean }[]>({ queryKey: ["/api/admin/crm/admins"], queryFn: () => adminFetch("/api/admin/crm/admins") });
  const suggestions = useQuery<{ id: string; name: string | null; phone: string }[]>({
    queryKey: ["/api/admin/users/suggest", customerSearch],
    enabled: !!editing && !customerId && customerSearch.trim().length >= 3,
    queryFn: () => adminFetch(`/api/admin/users/suggest?q=${encodeURIComponent(customerSearch.trim())}`),
  });
  const periods = ['day', 'week', 'month'] as const;
  const summaries = useQueries({ queries: periods.map((period) => ({
    queryKey: ["/api/admin/inventory/sales/summary", period, date],
    queryFn: (): Promise<{ sale_format: string; count: number; subtotal_cents: number; discount_cents: number; total_cents: number; gift_count: number; bonus_discount_count: number }[]> =>
      adminFetch(`/api/admin/inventory/sales/summary?period=${period}&date=${date}`),
  })) });
  const correct = useMutation({
    mutationFn: (payload: any) => adminFetch(`/api/admin/inventory/sales/${editing!.id}/correct`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries();
      toast({ title: "Продажа исправлена. Предыдущая версия сохранена в журнале." });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const cancel = useMutation({
    mutationFn: () => adminFetch(`/api/admin/inventory/sales/${editing!.id}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId: Number(actorId) }),
    }),
    onSuccess: () => {
      setEditing(null);
      setConfirmCancel(false);
      queryClient.invalidateQueries();
      toast({ title: "Продажа отменена. Остатки и XP пересчитаны." });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const openEditor = (sale: Sale) => {
    setEditing(sale);
    setConfirmCancel(false);
    setCorrectionRequestId(crypto.randomUUID());
    setFormat(sale.sale_format);
    setLines(sale.lines.map((line) => ({ productId: String(line.productId), quantity: String(line.quantity), price: String(line.priceCents / 100) })));
    setCustomerId(sale.user_id);
    setCustomerSearch(sale.user_id ? sale.buyer : "");
    setPrice(String(sale.subtotal_cents / 100));
    setDiscount(String(sale.discount_percent));
    setExtraDiscount(String(sale.extra_discount_percent));
    setBonusKind(sale.bonus_kind || "");
    setGiftProductId(sale.gift ? String(sale.gift.productId) : "");
    setGiftQuantity(sale.gift ? String(sale.gift.quantity) : "");
    setOccurredAt(moscowDateTime(sale.created_at));
  };
  const save = () => {
    if (!editing || !actorId || !lines.length || lines.some((line) => !line.productId || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
      toast({ title: "Проверьте сотрудника, чай и граммовку", variant: "destructive" }); return;
    }
    if (lines.some((line) => !/^\d+([.,]\d{1,2})?$/.test(line.price) || !Number.isFinite(Number(line.price.replace(",", "."))))) {
      toast({ title: "Проверьте цены товаров", variant: "destructive" }); return;
    }
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isInteger(cents) || cents < 0 || (format !== "loose" && cents === 0) ||
      ![discount, extraDiscount].every((value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100) ||
      (bonusKind === "gift" && (!giftProductId || !Number.isInteger(Number(giftQuantity)) || Number(giftQuantity) < 1))) {
      toast({ title: "Проверьте цену, скидки и подарок", variant: "destructive" }); return;
    }
    correct.mutate({
      requestId: correctionRequestId, actorId: Number(actorId), userId: customerId,
      saleFormat: format, servicePriceCents: format === "loose" ? undefined : cents,
      customerDiscountPercent: discount === "" ? undefined : Number(discount), extraDiscountPercent: Number(extraDiscount),
      bonusKind: bonusKind || null,
      gift: bonusKind === "gift" ? { productId: Number(giftProductId), quantity: Number(giftQuantity) } : null,
      occurredAt: `${occurredAt}:00+03:00`,
      lines: lines.map((line) => {
        const product = products.data?.find((item) => item.id === Number(line.productId));
        const priceCents = Math.round(Number(line.price.replace(",", ".")) * 100);
        return { productId: Number(line.productId), quantity: Number(line.quantity), priceCents,
          priceOverride: product ? priceCents !== product.price_cents : true };
      }),
    });
  };
  return <section className="space-y-5 border-t pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Продажи чая</h2><p className="text-sm text-muted-foreground">Время по Москве. Отменённые и исправленные продажи не входят в итоги.</p></div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Предыдущий день" onClick={() => { setDate(changeDay(date, -1)); setOffset(0); }}><ArrowLeft className="h-4 w-4" /></Button>
        <Input aria-label="Дата продаж" type="date" value={date} onChange={(event) => { setDate(event.target.value); setOffset(0); }} className="w-40" />
        <Button variant="outline" size="icon" aria-label="Следующий день" onClick={() => { setDate(changeDay(date, 1)); setOffset(0); }}><ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {summaries.map((query, index) => {
        const period = periods[index];
        const rows = query.data || [];
        const count = rows.reduce((sum, row) => sum + row.count, 0);
        const total = rows.reduce((sum, row) => sum + row.total_cents, 0);
        const discount = rows.reduce((sum, row) => sum + row.discount_cents, 0);
        const gifts = rows.reduce((sum, row) => sum + row.gift_count, 0);
        const bonusDiscounts = rows.reduce((sum, row) => sum + row.bonus_discount_count, 0);
        return <div key={period} className="border-y py-3">
          <p className="text-sm text-muted-foreground">{period === "day" ? "День" : period === "week" ? "Неделя" : "Месяц"}</p>
          <p className="text-lg font-semibold">{money(total)} · {count} продаж</p>
          <p className="text-xs text-muted-foreground">Скидки: {money(discount)}</p>
          <p className="text-xs text-muted-foreground">Бонусы: {gifts} подарков · {bonusDiscounts} скидок</p>
          <p className="text-xs text-muted-foreground">{rows.map((row) => `${formatNames[row.sale_format] || row.sale_format}: ${row.count}`).join(" · ")}</p>
        </div>;
      })}
    </div>
    <Input type="search" aria-label="Поиск продаж" placeholder="Клиент, чай или номер продажи" value={search}
      onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
    {sales.isError && <p role="alert" className="text-destructive">Не удалось загрузить продажи.</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
      <thead><tr className="border-b text-muted-foreground"><th className="p-2">Время</th><th className="p-2">Формат</th><th className="p-2">Чай</th><th className="p-2">Клиент</th><th className="p-2">Цена</th><th className="p-2">Скидка</th><th className="p-2">Итог</th><th className="p-2">Статус</th><th className="p-2"></th></tr></thead>
      <tbody>{sales.data?.map((sale) => <tr key={sale.id} className="border-b align-top">
        <td className="p-2 whitespace-nowrap">{new Date(sale.created_at).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" })}<span className="block text-xs text-muted-foreground">№{sale.id}</span></td>
        <td className="p-2">{formatNames[sale.sale_format] || sale.sale_format}</td>
        <td className="p-2">{sale.lines.map((line) => `${line.name} · ${line.quantity} ${line.unit}`).join(", ")}{sale.gift && <span className="block text-xs">Подарок: {sale.gift.name} · {sale.gift.quantity} г</span>}{sale.bonus_kind === "discount" && <span className="block text-xs">Бонус: скидка 20%</span>}</td>
        <td className="p-2">{sale.user_id ? sale.buyer : "Анонимный"}</td>
        <td className="p-2 whitespace-nowrap">{money(sale.subtotal_cents)}</td><td className="p-2 whitespace-nowrap">−{money(sale.discount_cents)}</td>
        <td className="p-2 whitespace-nowrap font-medium">{money(sale.total_cents)}</td>
        <td className="p-2">{sale.status === "completed" ? "Проведена" : sale.status === "corrected" ? "Исправлена" : "Отменена"}</td>
        <td className="p-2">{sale.status === "completed" && <Button type="button" variant="ghost" size="icon" aria-label={`Исправить продажу ${sale.id}`} onClick={() => openEditor(sale)}><Pencil className="h-4 w-4" /></Button>}</td>
      </tr>)}</tbody>
    </table>{sales.data && !sales.data.length && <p className="py-5 text-sm text-muted-foreground">Продаж за этот день не найдено.</p>}</div>
    <div className="flex items-center gap-2"><Button variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 100))}>Назад</Button><span className="text-sm">{offset + 1}–{offset + (sales.data?.length || 0)}</span><Button variant="outline" disabled={(sales.data?.length || 0) < 100} onClick={() => setOffset(offset + 100)}>Дальше</Button></div>
    <Dialog open={!!editing} onOpenChange={(open) => !open && !correct.isPending && !cancel.isPending && setEditing(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Исправить продажу №{editing?.id}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Старая версия останется в журнале. Остатки и XP пересчитаются автоматически.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Дата и время, МСК<Input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
        <label className="text-sm">Сотрудник<select className="flex h-10 w-full rounded-md border bg-background px-3" value={actorId} onChange={(event) => setActorId(event.target.value)}><option value="">Выберите</option>{admins.data?.filter((admin) => admin.isActive).map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label>
        <label className="text-sm">Формат<select className="flex h-10 w-full rounded-md border bg-background px-3" value={format} onChange={(event) => setFormat(event.target.value as Sale["sale_format"])}>{Object.entries(formatNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-sm">Цена продажи, ₽<Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} disabled={format === "loose"} /></label>
      </div>
      <div className="space-y-2"><p className="text-sm font-medium">Чай и граммы</p>{lines.map((line, index) => <div key={index} className="flex flex-wrap gap-2">
        <select aria-label={`Товар ${index + 1}`} className="min-w-[10rem] flex-1 rounded-md border bg-background px-2" value={line.productId} onChange={(event) => { const item = products.data?.find((product) => product.id === Number(event.target.value)); setLines(lines.map((value, n) => n === index ? { ...value, productId: event.target.value, price: item ? String(item.price_cents / 100) : value.price } : value)); }}><option value="">Выберите</option>{products.data?.filter((product) => format === "loose" || product.category === "tea").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
        <Input aria-label={`Граммы ${index + 1}`} type="number" min="1" step="1" className="w-20" value={line.quantity} onChange={(event) => setLines(lines.map((value, n) => n === index ? { ...value, quantity: event.target.value } : value))} />
        <Input aria-label={`Цена за единицу ${index + 1}`} inputMode="decimal" className="w-24" value={line.price} onChange={(event) => setLines(lines.map((value, n) => n === index ? { ...value, price: event.target.value } : value))} />
        <Button variant="ghost" size="icon" aria-label={`Удалить товар ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, n) => n !== index))}><Trash2 className="h-4 w-4" /></Button>
      </div>)}<Button variant="outline" size="sm" onClick={() => setLines([...lines, { productId: "", quantity: "", price: "" }])}><Plus className="mr-1 h-4 w-4" />Товар</Button></div>
      <div className="space-y-2"><p className="text-sm font-medium">Клиент</p><div className="flex gap-2"><Button variant={customerId ? "outline" : "default"} onClick={() => { setCustomerId(null); setCustomerSearch(""); setDiscount("0"); setBonusKind(""); }}>Анонимный</Button><Input aria-label="Найти клиента для исправления" placeholder="Имя или телефон" value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerId(null); setDiscount(""); setBonusKind(""); }} /></div>{!customerId && suggestions.data?.map((customer) => <Button key={customer.id} type="button" size="sm" variant="outline" onClick={() => { setCustomerId(customer.id); setCustomerSearch(`${customer.name || ""} · ${customer.phone}`); setDiscount(""); }}>{customer.name || customer.phone} · {customer.phone}</Button>)}{customerId && <p className="text-xs text-muted-foreground">Клиент выбран</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Скидка клиента, %<Input type="number" min="0" max="100" placeholder="Авто по уровню" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label className="text-sm">Дополнительная скидка, %<Input type="number" min="0" max="100" value={extraDiscount} onChange={(event) => setExtraDiscount(event.target.value)} /></label></div>
      <label className="text-sm">Бонус новому клиенту<select className="flex h-10 w-full rounded-md border bg-background px-3" value={bonusKind} onChange={(event) => setBonusKind(event.target.value as typeof bonusKind)}><option value="">Нет</option><option value="discount">Скидка 20%</option><option value="gift">Чай в подарок</option></select></label>
      {bonusKind === "gift" && <div className="flex gap-2"><select aria-label="Подарочный чай" className="min-w-0 flex-1 rounded-md border bg-background px-2" value={giftProductId} onChange={(event) => setGiftProductId(event.target.value)}><option value="">Выберите чай</option>{products.data?.filter((product) => product.category === "tea").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><Input aria-label="Граммы подарка" type="number" min="1" className="w-24" value={giftQuantity} onChange={(event) => setGiftQuantity(event.target.value)} /></div>}
      <p className="text-sm">Цена: {money(Math.round(editSubtotal))}{customerId && discount === "" && bonusKind !== "discount"
        ? " · скидка и итог пересчитаются по профилю клиента"
        : <> · скидка: −{money(Math.round(editSubtotal - editTotal))} · <strong>итог: {money(editTotal)}</strong></>}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={correct.isPending || cancel.isPending} onClick={save}>{correct.isPending ? "Сохраняем…" : "Сохранить исправление"}</Button>
        <Button variant="outline" disabled={correct.isPending || cancel.isPending} onClick={() => setConfirmCancel(true)}>Отменить продажу</Button>
      </div>
      {confirmCancel && <div className="space-y-2 border-t pt-3"><p className="text-sm">Вернуть чай на склад и списать начисленные XP? Действие останется в журнале.</p><Button variant="destructive" disabled={!actorId || cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? "Отменяем…" : "Подтвердить отмену"}</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Оставить продажу</Button></div>}
    </DialogContent></Dialog>
  </section>;
}
