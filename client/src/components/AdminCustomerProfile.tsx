import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { AdminCustomerProfile as Profile } from "@shared/admin-customer";

const profileEvent = "admin-customer-profile";
type Target = { userId?: string | null; contactId?: number | null };
export function customerProfileHref(target: Target) {
  const url = new URL(window.location.href);
  url.pathname = "/admin";
  url.searchParams.delete("customer"); url.searchParams.delete("contact");
  if (target.userId) url.searchParams.set("customer", target.userId);
  else if (target.contactId) url.searchParams.set("contact", String(target.contactId));
  return url.pathname + url.search;
}
export function openAdminCustomer(target: Target) {
  window.history.replaceState(null, "", customerProfileHref(target));
  window.dispatchEvent(new Event(profileEvent));
}
export function AdminCustomerLink({ userId, contactId, children, className = "" }: Target & { children: ReactNode; className?: string }) {
  if (!userId && !contactId) return <>{children}</>;
  return <a className={`cursor-pointer text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary ${className}`} href={customerProfileHref({ userId, contactId })} onKeyDown={(event) => event.stopPropagation()} onClick={(event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openAdminCustomer({ userId, contactId }); }
  }}>{children}</a>;
}

const readTarget = (): Target | null => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("customer")) return { userId: params.get("customer") };
  if (/^[1-9]\d*$/.test(params.get("contact") || "")) return { contactId: Number(params.get("contact")) };
  return null;
};
const money = (cents: number) => (cents / 100).toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
const date = (value: string | null) => value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const status: Record<string, string> = { paid: "Оплачен", completed: "Завершён", pending: "Не оплачен", cancelled: "Отменён", corrected: "Исправлен" };
const formats: Record<string, string> = { loose: "Рассыпной", teapot: "Чайник", ceremony: "Церемония", cup: "Кружка", online: "Сайт" };

export default function AdminCustomerProfile({ adminFetch }: { adminFetch: (url: string, options?: RequestInit) => Promise<any> }) {
  const [target, setTarget] = useState<Target | null>(readTarget);
  const [offset, setOffset] = useState(0);
  const [xpOffset, setXpOffset] = useState(0);
  useEffect(() => {
    const update = () => { setTarget(readTarget()); setOffset(0); setXpOffset(0); };
    window.addEventListener(profileEvent, update); window.addEventListener("popstate", update);
    return () => { window.removeEventListener(profileEvent, update); window.removeEventListener("popstate", update); };
  }, []);
  const profile = useQuery<Profile>({
    queryKey: ["/api/admin/customer-profile", target?.userId, target?.contactId, offset, xpOffset],
    enabled: !!target,
    placeholderData: (previous, query) => query?.queryKey[1] === target?.userId && query?.queryKey[2] === target?.contactId ? previous : undefined,
    queryFn: () => {
      const params = new URLSearchParams({ offset: String(offset), xpOffset: String(xpOffset) });
      if (target?.userId) params.set("userId", target.userId); else params.set("contactId", String(target?.contactId));
      return adminFetch(`/api/admin/customer-profile?${params}`);
    },
  });
  const close = () => {
    const url = new URL(window.location.href); url.searchParams.delete("customer"); url.searchParams.delete("contact");
    window.history.replaceState(null, "", url.pathname + url.search); setTarget(null);
  };
  return <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
    <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
      <DialogHeader><DialogTitle>{profile.data?.customer.name || "Профиль клиента"}</DialogTitle><DialogDescription className="sr-only">Покупки, чайные предпочтения и XP клиента</DialogDescription></DialogHeader>
      {profile.isLoading && <p role="status">Загружаем профиль…</p>}
      {profile.isError && <div role="alert" className="space-y-2"><p>{profile.error.message}</p><Button variant="outline" onClick={() => profile.refetch()}>Повторить</Button></div>}
      {profile.data && <CustomerContents key={`${target?.userId || ""}:${target?.contactId || ""}`} data={profile.data} adminFetch={adminFetch} offset={offset} setOffset={setOffset} xpOffset={xpOffset} setXpOffset={setXpOffset} />}
    </DialogContent>
  </Dialog>;
}

function CustomerContents({ data, adminFetch, offset, setOffset, xpOffset, setXpOffset }: {
  data: Profile; adminFetch: (url: string, options?: RequestInit) => Promise<any>;
  offset: number; setOffset: (offset: number) => void; xpOffset: number; setXpOffset: (offset: number) => void;
}) {
  const { customer, loyalty, summary } = data;
  const [teaSearch, setTeaSearch] = useState("");
  const [mode, setMode] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [actorId, setActorId] = useState(() => sessionStorage.getItem("crmActiveAdminId") || "");
  const [pending, setPending] = useState<{ requestId: string; actorId: number; amount: number; description: string } | null>(null);
  const qc = useQueryClient(); const { toast } = useToast();
  const admins = useQuery<{ id: number; name: string; isActive: boolean }[]>({ queryKey: ["/api/admin/crm/admins"], queryFn: () => adminFetch("/api/admin/crm/admins"), enabled: !!customer.id });
  const adjust = useMutation({
    mutationFn: (payload: NonNullable<typeof pending>) => adminFetch(`/api/admin/customer-profile/${encodeURIComponent(customer.id!)}/xp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => { setAmount(""); setReason(""); setPending(null); setXpOffset(0); qc.invalidateQueries(); toast({ title: "Баланс XP обновлён" }); },
    onError: (error: Error) => toast({ title: error.message, description: "Можно повторить запрос: XP не изменятся дважды.", variant: "destructive" }),
  });
  const amountValid = /^\d+$/.test(amount) && Number(amount) > 0 && Number(amount) <= 10000000 && (mode === "add" || Number(amount) <= (loyalty?.xp || 0));
  const teas = data.teas.filter((tea) => tea.name.toLowerCase().includes(teaSearch.toLowerCase()));
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}
      {customer.email && <a href={`mailto:${customer.email}`} className="break-all">{customer.email}</a>}
      <span className="text-muted-foreground">Ответственный: {customer.ownerName || "Не назначен"}</span>
      {customer.source && <span className="text-muted-foreground">Источник: {customer.source}</span>}
    </div>
    <dl className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Завершённые покупки</dt><dd className="text-xl font-semibold">{summary.purchaseCount}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Сумма покупок</dt><dd className="text-xl font-semibold">{money(summary.totalCents)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">XP · {loyalty?.levelName || "Нет аккаунта"}</dt><dd className="text-xl font-semibold">{loyalty ? loyalty.xp.toLocaleString("ru-RU") : "—"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Скидка клиента</dt><dd className="text-xl font-semibold">{loyalty ? `${loyalty.discountPercent}%` : "—"}</dd>{loyalty?.customDiscount !== null && loyalty && <p className="text-xs text-muted-foreground">Индивидуальная · по уровню {loyalty.loyaltyDiscountPercent}%</p>}</div>
    </dl>
    <p className="text-xs text-muted-foreground">Последняя покупка: {date(summary.lastPurchaseAt)}</p>
    {!customer.id && <p className="text-sm text-muted-foreground">Контакт ещё не связан с аккаунтом покупателя. Покупки и XP появятся после привязки; фиктивный аккаунт не создаётся.</p>}
    <Tabs defaultValue="purchases">
      <TabsList className="h-auto flex-wrap"><TabsTrigger value="purchases">Покупки ({data.purchaseCount})</TabsTrigger><TabsTrigger value="teas">Чаи ({data.teas.length})</TabsTrigger><TabsTrigger value="xp">XP и история</TabsTrigger></TabsList>
      <TabsContent value="purchases" className="space-y-3">
        {data.purchases.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Покупок пока нет.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2">Дата / чек</th><th className="p-2">Состав</th><th className="p-2">Статус</th><th className="p-2 text-right">Оплата</th></tr></thead><tbody>{data.purchases.map((purchase) => <tr key={`${purchase.source}:${purchase.id}`} className="border-b align-top"><td className="p-2 whitespace-nowrap">{date(purchase.createdAt)}<p className="text-xs text-muted-foreground">{purchase.source === "inventory" ? "CRM" : "Сайт"} · №{purchase.id}</p></td><td className="min-w-48 p-2">{purchase.lines.map((line, index) => <p key={index}>{line.name} · {line.quantity} {line.unit === "piece" ? "шт" : "г"} <span className="text-xs text-muted-foreground">{formats[line.format] || line.format}</span></p>)}{purchase.comment && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{purchase.comment}</p>}</td><td className="p-2">{status[purchase.status] || purchase.status}</td><td className="p-2 text-right whitespace-nowrap">{money(purchase.totalCents)}</td></tr>)}</tbody></table></div>}
        <Pager offset={offset} count={data.purchaseCount} onChange={setOffset} />
      </TabsContent>
      <TabsContent value="teas" className="space-y-3">
        <Input aria-label="Поиск в чаях клиента" placeholder="Найти чай" value={teaSearch} onChange={(event) => setTeaSearch(event.target.value)} />
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2">Чай</th><th className="p-2">Граммы</th><th className="p-2">Покупки</th><th className="p-2">Последний раз</th></tr></thead><tbody>{teas.map((tea) => <tr key={tea.key} className="border-b"><td className="p-2">{tea.name}</td><td className="p-2">{tea.grams}</td><td className="p-2">{tea.purchases}</td><td className="p-2 whitespace-nowrap">{date(tea.lastAt)}</td></tr>)}</tbody></table></div>
        {!teas.length && <p className="text-sm text-muted-foreground">Чаи не найдены.</p>}
      </TabsContent>
      <TabsContent value="xp" className="space-y-4">
        {loyalty && <form className="space-y-3 border-b pb-4" onSubmit={(event) => {
          event.preventDefault(); if (!pending && (!amountValid || reason.trim().length < 2 || !admins.data?.some((admin) => String(admin.id) === actorId && admin.isActive))) return;
          const payload = pending || { requestId: crypto.randomUUID(), actorId: Number(actorId), amount: Number(amount) * (mode === "add" ? 1 : -1), description: reason.trim() };
          setPending(payload); adjust.mutate(payload);
        }}>
          <fieldset disabled={!!pending} className="space-y-3">
            <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={mode === "add" ? "default" : "outline"} onClick={() => setMode("add")}><Plus className="mr-1 h-4 w-4" />Начислить</Button><Button type="button" size="sm" variant={mode === "subtract" ? "default" : "outline"} onClick={() => setMode("subtract")}><Minus className="mr-1 h-4 w-4" />Списать</Button></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Количество XP<Input inputMode="numeric" aria-label="Количество XP" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="text-sm">Сотрудник<select aria-label="Сотрудник" className="h-10 w-full rounded-md border bg-background px-2" value={actorId} onChange={(event) => setActorId(event.target.value)}><option value="">Выберите сотрудника</option>{admins.data?.filter((admin) => admin.isActive).map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label></div>
            <label className="block text-sm">Причина<Input maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Например, подарок ко дню рождения" /></label>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={adjust.isPending || (!pending && (!amountValid || reason.trim().length < 2 || !actorId))}>{adjust.isPending ? "Сохраняем…" : pending ? "Повторить операцию" : mode === "add" ? "Начислить XP" : "Списать XP"}</Button>{pending && !adjust.isPending && <Button type="button" variant="outline" onClick={() => { setPending(null); adjust.reset(); }}>Изменить данные</Button>}{!pending && amountValid && <span className="text-sm text-muted-foreground">После операции: {loyalty.xp + Number(amount) * (mode === "add" ? 1 : -1)} XP</span>}</div>
          {admins.isError && <p role="alert" className="text-sm text-destructive">Не удалось загрузить сотрудников. <button type="button" className="underline" onClick={() => admins.refetch()}>Повторить</button></p>}
        </form>}
        {data.xpHistory.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 border-b py-2 text-sm"><div><p className="whitespace-pre-wrap break-words">{entry.description}</p><p className="text-xs text-muted-foreground">{date(entry.createdAt)} · {entry.createdBy || "Система"}</p></div><strong className={entry.amount > 0 ? "text-emerald-700" : "text-destructive"}>{entry.amount > 0 ? "+" : ""}{entry.amount} XP</strong></div>)}
        {!data.xpHistory.length && <p className="text-sm text-muted-foreground">Операций с XP пока нет.</p>}
        <Pager offset={xpOffset} count={data.xpCount} onChange={setXpOffset} />
      </TabsContent>
    </Tabs>
    {customer.notes && <div className="border-t pt-3 text-sm"><h3 className="mb-1 font-medium">Заметки CRM</h3><p className="whitespace-pre-wrap break-words">{customer.notes}</p></div>}
  </div>;
}

function Pager({ offset, count, onChange }: { offset: number; count: number; onChange: (offset: number) => void }) {
  if (count <= 30) return null;
  return <div className="flex items-center justify-end gap-2 text-xs"><span>{offset + 1}–{Math.min(offset + 30, count)} из {count}</span><Button type="button" size="icon" variant="outline" aria-label="Предыдущая страница" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - 30))}><ArrowLeft className="h-4 w-4" /></Button><Button type="button" size="icon" variant="outline" aria-label="Следующая страница" disabled={offset + 30 >= count} onClick={() => onChange(offset + 30)}><ArrowRight className="h-4 w-4" /></Button></div>;
}
