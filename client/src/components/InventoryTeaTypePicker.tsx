import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, ChevronsUpDown } from "lucide-react";
import { useTeaTypes } from "@/hooks/use-tea-types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function InventoryTeaTypePicker({ value, onChange, adminFetch }: {
  value: string; onChange: (value: string) => void;
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
}) {
  const { data: types = [] } = useTeaTypes();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState("#4f9273");
  const create = useMutation({
    mutationFn: () => adminFetch("/api/tea-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: search.trim(), backgroundColor: color, textColor: "#FFFFFF" }) }),
    onSuccess: (type) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tea-types"] });
      onChange(type.name); setOpen(false); setCreating(false);
      toast({ title: "Тип чая добавлен" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });
  const selected = types.find((type) => type.name === value);
  return <Popover open={open} onOpenChange={(next) => { if (!create.isPending) { setOpen(next); setCreating(false); setSearch(""); } }}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="Тип чая" aria-expanded={open} className="w-full justify-between font-normal">
      <span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: selected?.backgroundColor || "#999999" }} /><span className="truncate">{value || "Выберите тип чая"}</span></span><ChevronsUpDown className="h-4 w-4 shrink-0" />
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[min(24rem,calc(100vw-3rem))] space-y-2">
      <Input aria-label={creating ? "Название нового типа чая" : "Поиск типа чая"} placeholder={creating ? "Название нового типа" : "Найти тип чая"} maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} />
      {!creating ? <>
        <div className="max-h-52 overflow-y-auto">{types.filter((type) => type.name.toLowerCase().includes(search.toLowerCase())).map((type) => <Button key={type.id} type="button" variant="ghost" className="w-full justify-start gap-2" onClick={() => { onChange(type.name); setOpen(false); }}><span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: type.backgroundColor }} />{type.name}</Button>)}</div>
        <Button type="button" variant="outline" className="w-full" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Добавить новый тип чая</Button>
      </> : <>
        <label className="flex items-center gap-2 text-sm">Цвет<input type="color" aria-label="Цвет типа чая" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <Button type="button" disabled={search.trim().length < 2 || types.some((type) => type.name.toLowerCase() === search.trim().toLowerCase()) || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Сохраняем…" : "Добавить тип"}</Button>
      </>}
    </PopoverContent>
  </Popover>;
}
