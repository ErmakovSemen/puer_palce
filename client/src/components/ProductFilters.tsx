import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
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
  selectedType,
  onTypeChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
      <div className="relative flex-1 w-full md:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Найти чай..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

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
  );
}
