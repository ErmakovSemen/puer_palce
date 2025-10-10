import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Search } from "lucide-react";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (value: [number, number]) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
}

const teaTypes = [
  { id: "all", label: "Все виды" },
  { id: "shu", label: "Шу Пуэр" },
  { id: "shen", label: "Шен Пуэр" },
  { id: "aged", label: "Выдержанный" },
];

export default function ProductFilters({
  searchTerm,
  onSearchChange,
  priceRange,
  onPriceRangeChange,
  selectedType,
  onTypeChange,
}: ProductFiltersProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="search" className="mb-2 block">Поиск</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Найти чай..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Тип чая</Label>
        <div className="flex flex-wrap gap-2">
          {teaTypes.map((type) => (
            <Button
              key={type.id}
              variant={selectedType === type.id ? "default" : "outline"}
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
        <Label className="mb-3 block">
          Цена: {priceRange[0]} - {priceRange[1]} ₽
        </Label>
        <Slider
          min={0}
          max={3000}
          step={100}
          value={priceRange}
          onValueChange={onPriceRangeChange as (value: number[]) => void}
          data-testid="slider-price"
        />
      </div>
    </div>
  );
}
