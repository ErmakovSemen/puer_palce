import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, Filter, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdminFetch = (url: string, options?: RequestInit) => Promise<any>;
type DirectoryUser = {
  id: string; name: string | null; phone: string; email: string | null; phoneVerified: boolean; xp: number;
  firstOrderDiscountUsed: boolean; customDiscount: number | null; walletBalance: number; analytics: string | null; source: string | null;
  orderCount: number; totalSpent: number; lastOrderAt: string | null; lastOrderStatus: string | null;
};
type SortField = "name" | "phone" | "email" | "xp" | "walletBalance" | "source" | "orderCount" | "totalSpent" | "lastOrderAt";
type Filters = { search: string; source: string; minXp: string; maxXp: string; minBalance: string; maxBalance: string; verified: string; discount: string; firstDiscount: string; orderAge: string; lastOrderFrom: string; lastOrderTo: string; analytics: string };
const EMPTY: Filters = { search: "", source: "all", minXp: "", maxXp: "", minBalance: "", maxBalance: "", verified: "all", discount: "all", firstDiscount: "all", orderAge: "all", lastOrderFrom: "", lastOrderTo: "", analytics: "" };
const dateFormat = (value: string | null) => value ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "-";

export default function AdminCustomerDirectory({ adminFetch, enabled }: { adminFetch: AdminFetch; enabled: boolean }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sortBy, setSortBy] = useState<SortField>("lastOrderAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const { data: users = [], isLoading } = useQuery<DirectoryUser[]>({ queryKey: ["/api/admin/crm/users"], queryFn: () => adminFetch("/api/admin/crm/users"), enabled });
  const sources = useMemo(() => Array.from(new Set(users.map((user) => user.source || "Без источника"))).sort(), [users]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const daysSince = (value: string | null) => value ? Math.floor((now - new Date(value).getTime()) / 86_400_000) : Infinity;
    const numberPass = (value: number, min: string, max: string) => (!min || value >= Number(min)) && (!max || value <= Number(max));
    return users.filter((user) => {
      const searchable = [user.id, user.name, user.phone, user.email, user.source, user.analytics].filter(Boolean).join(" ").toLowerCase();
      if (filters.search && !searchable.includes(filters.search.toLowerCase())) return false;
      if (filters.source !== "all" && (user.source || "Без источника") !== filters.source) return false;
      if (!numberPass(user.xp, filters.minXp, filters.maxXp) || !numberPass(user.walletBalance / 100, filters.minBalance, filters.maxBalance)) return false;
      if (filters.verified !== "all" && String(user.phoneVerified) !== filters.verified) return false;
      if (filters.firstDiscount !== "all" && String(user.firstOrderDiscountUsed) !== filters.firstDiscount) return false;
      if (filters.discount === "yes" && user.customDiscount === null) return false;
      if (filters.discount === "no" && user.customDiscount !== null) return false;
      if (filters.analytics && !(user.analytics || "").toLowerCase().includes(filters.analytics.toLowerCase())) return false;
      const age = daysSince(user.lastOrderAt);
      const orderTime = user.lastOrderAt ? new Date(user.lastOrderAt).getTime() : null;
      if ((filters.lastOrderFrom || filters.lastOrderTo) && orderTime === null) return false;
      if (filters.lastOrderFrom && orderTime! < new Date(`${filters.lastOrderFrom}T00:00:00`).getTime()) return false;
      if (filters.lastOrderTo && orderTime! > new Date(`${filters.lastOrderTo}T23:59:59.999`).getTime()) return false;
      if (filters.orderAge === "none" && user.lastOrderAt) return false;
      if (filters.orderAge === "has_orders" && !user.lastOrderAt) return false;
      if (filters.orderAge === "under21" && !(age < 21)) return false;
      if (filters.orderAge === "over21" && !(age >= 21 && age < 45)) return false;
      if (filters.orderAge === "over45" && (!user.lastOrderAt || !(age >= 45))) return false;
      return true;
    }).sort((a, b) => {
      const aValue = sortBy === "lastOrderAt" ? (a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0) : a[sortBy];
      const bValue = sortBy === "lastOrderAt" ? (b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0) : b[sortBy];
      const result = typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue || "").localeCompare(String(bValue || ""), "ru");
      return direction === "asc" ? result : -result;
    });
  }, [users, filters, sortBy, direction]);

  const set = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const sourcesForCsv = filtered.reduce((acc, user) => { const key = user.source || "Без источника"; acc[key] = (acc[key] || 0) + 1; return acc; }, {} as Record<string, number>);

  return <div className="space-y-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-2xl font-semibold">База клиентов</h2><p className="mt-1 text-sm text-muted-foreground">Все аккаунты и их покупки. Пароли не показываются и не фильтруются.</p></div><p className="text-sm text-muted-foreground">Показано: {filtered.length} из {users.length}</p></div>
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-4 w-4" />Фильтры</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><FilterInput label="Поиск по имени, ID, телефону, email" value={filters.search} onChange={(value) => set("search", value)} /><SelectField label="Источник" value={filters.source} onValueChange={(value) => set("source", value)} options={[{ value: "all", label: "Все источники" }, ...sources.map((source) => ({ value: source, label: source }))]} /><NumberPair label="XP" min={filters.minXp} max={filters.maxXp} onMin={(value) => set("minXp", value)} onMax={(value) => set("maxXp", value)} /><NumberPair label="Баланс, руб." min={filters.minBalance} max={filters.maxBalance} onMin={(value) => set("minBalance", value)} onMax={(value) => set("maxBalance", value)} /><SelectField label="Телефон подтвержден" value={filters.verified} onValueChange={(value) => set("verified", value)} options={[{ value: "all", label: "Любой" }, { value: "true", label: "Да" }, { value: "false", label: "Нет" }]} /><SelectField label="Персональная скидка" value={filters.discount} onValueChange={(value) => set("discount", value)} options={[{ value: "all", label: "Любая" }, { value: "yes", label: "Есть" }, { value: "no", label: "Нет" }]} /><SelectField label="Использовал первую скидку" value={filters.firstDiscount} onValueChange={(value) => set("firstDiscount", value)} options={[{ value: "all", label: "Любой" }, { value: "true", label: "Да" }, { value: "false", label: "Нет" }]} /><SelectField label="Последняя покупка" value={filters.orderAge} onValueChange={(value) => set("orderAge", value)} options={[{ value: "all", label: "Любое время" }, { value: "has_orders", label: "Есть покупки" }, { value: "under21", label: "Менее 21 дня" }, { value: "over21", label: "21-44 дня назад" }, { value: "over45", label: "45+ дней назад" }, { value: "none", label: "Без покупок" }]} /><DatePair label="Дата последней покупки" from={filters.lastOrderFrom} to={filters.lastOrderTo} onFrom={(value) => set("lastOrderFrom", value)} onTo={(value) => set("lastOrderTo", value)} /><FilterInput label="Аналитика / A-B данные" value={filters.analytics} onChange={(value) => set("analytics", value)} /><div className="flex items-end gap-2"><SelectField label="Сортировка" value={sortBy} onValueChange={(value) => setSortBy(value as SortField)} options={[{ value: "lastOrderAt", label: "Последняя покупка" }, { value: "name", label: "Имя" }, { value: "phone", label: "Телефон" }, { value: "email", label: "Email" }, { value: "xp", label: "XP" }, { value: "walletBalance", label: "Баланс" }, { value: "source", label: "Источник" }, { value: "orderCount", label: "Число покупок" }, { value: "totalSpent", label: "Сумма покупок" }]} /><Button variant="outline" size="icon" onClick={() => setDirection((current) => current === "asc" ? "desc" : "asc")} aria-label="Сменить порядок сортировки"><ArrowDownUp className="h-4 w-4" /></Button></div><div className="flex items-end"><Button variant="ghost" onClick={() => setFilters(EMPTY)}><SlidersHorizontal className="mr-2 h-4 w-4" />Сбросить</Button></div></CardContent></Card>
    <Card><CardContent className="p-0">{isLoading ? <p className="p-6 text-sm text-muted-foreground">Загружаем базу...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3">Клиент</th><th className="p-3">Контакты</th><th className="p-3">Источник</th><th className="p-3 text-right">XP</th><th className="p-3 text-right">Баланс</th><th className="p-3 text-right">Заказы</th><th className="p-3 text-right">Сумма</th><th className="p-3">Последняя покупка</th><th className="p-3">Статус</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30"><td className="p-3"><p className="font-medium">{user.name || "Без имени"}</p><p className="max-w-28 truncate text-xs text-muted-foreground" title={user.id}>{user.id}</p></td><td className="p-3"><p>{user.phone}</p><p className="text-xs text-muted-foreground">{user.email || "-"}</p></td><td className="p-3">{user.source || "-"}</td><td className="p-3 text-right">{user.xp}</td><td className="p-3 text-right">{(user.walletBalance / 100).toLocaleString("ru-RU")} ₽</td><td className="p-3 text-right">{user.orderCount}</td><td className="p-3 text-right">{user.totalSpent.toLocaleString("ru-RU")} ₽</td><td className="p-3">{dateFormat(user.lastOrderAt)}</td><td className="p-3">{user.phoneVerified ? "Подтвержден" : "Не подтвержден"}{user.customDiscount !== null ? ` · скидка ${user.customDiscount}%` : ""}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="p-6 text-sm text-muted-foreground">Подходящих пользователей нет.</p>}</div>}</CardContent></Card>
    {Object.keys(sourcesForCsv).length > 0 && <p className="text-xs text-muted-foreground">По источникам в выборке: {Object.entries(sourcesForCsv).map(([source, count]) => `${source}: ${count}`).join(" · ")}</p>}
  </div>;
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Label className="grid gap-1.5 text-xs text-muted-foreground">{label}<div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" /><Input className="h-9 pl-8 text-sm" value={value} onChange={(event) => onChange(event.target.value)} /></div></Label>; }
function SelectField({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: { value: string; label: string }[] }) { return <Label className="grid gap-1.5 text-xs text-muted-foreground">{label}<Select value={value} onValueChange={onValueChange}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Label>; }
function NumberPair({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (value: string) => void; onMax: (value: string) => void }) { return <Label className="grid gap-1.5 text-xs text-muted-foreground">{label}<div className="grid grid-cols-2 gap-2"><Input className="h-9 text-sm" type="number" value={min} onChange={(event) => onMin(event.target.value)} placeholder="от" /><Input className="h-9 text-sm" type="number" value={max} onChange={(event) => onMax(event.target.value)} placeholder="до" /></div></Label>; }
function DatePair({ label, from, to, onFrom, onTo }: { label: string; from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) { return <Label className="grid gap-1.5 text-xs text-muted-foreground">{label}<div className="grid grid-cols-2 gap-2"><Input className="h-9 text-sm" type="date" value={from} onChange={(event) => onFrom(event.target.value)} /><Input className="h-9 text-sm" type="date" value={to} onChange={(event) => onTo(event.target.value)} /></div></Label>; }
