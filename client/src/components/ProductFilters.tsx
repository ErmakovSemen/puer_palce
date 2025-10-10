import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedEffects: string[];
  onEffectsChange: (effects: string[]) => void;
}

const teaTypes = [
  { id: "all", label: "Все виды" },
  { id: "shu", label: "Шу Пуэр" },
  { id: "shen", label: "Шен Пуэр" },
  { id: "aged", label: "Выдержанный" },
];

const effects = [
  { id: "бодрит", label: "Бодрит" },
  { id: "успокаивает", label: "Успокаивает" },
  { id: "концентрирует", label: "Концентрирует" },
  { id: "согревает", label: "Согревает" },
  { id: "расслабляет", label: "Расслабляет" },
  { id: "тонизирует", label: "Тонизирует" },
];

export default function ProductFilters({
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedEffects,
  onEffectsChange,
}: ProductFiltersProps) {
  const toggleEffect = (effectId: string) => {
    if (selectedEffects.includes(effectId)) {
      onEffectsChange(selectedEffects.filter(e => e !== effectId));
    } else {
      onEffectsChange([...selectedEffects, effectId]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Найти чай..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Тип чая</Label>
        <div className="flex flex-wrap gap-2">
          {teaTypes.map((type) => (
            <Button
              key={type.id}
              variant={selectedType === type.id ? "default" : "outline"}
              size="sm"
              onClick={() => onTypeChange(type.id)}
              className={selectedType === type.id ? "bg-primary text-primary-foreground border border-primary-border" : ""}
              data-testid={`button-filter-${type.id}`}
            >
              {type.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Эффект</Label>
        <div className="flex flex-wrap gap-2">
          {effects.map((effect) => (
            <Button
              key={effect.id}
              variant={selectedEffects.includes(effect.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleEffect(effect.id)}
              className={selectedEffects.includes(effect.id) ? "bg-primary text-primary-foreground border border-primary-border" : ""}
              data-testid={`button-effect-${effect.id}`}
            >
              {effect.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
