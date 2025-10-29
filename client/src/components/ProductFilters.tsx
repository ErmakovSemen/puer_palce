import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getTeaTypeBadgeStyleDynamic } from "@/lib/tea-colors";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useTeaTypes } from "@/hooks/use-tea-types";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  selectedEffects: string[];
  onEffectsChange: (effects: string[]) => void;
  onQuizClick: () => void;
}

export default function ProductFilters({
  searchTerm,
  onSearchChange,
  selectedTypes,
  onTypesChange,
  selectedEffects,
  onEffectsChange,
  onQuizClick,
}: ProductFiltersProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch tea types from API for colors
  const { data: teaTypesFromAPI } = useTeaTypes();

  // Fetch dynamic tags from API
  const { data: tags, isLoading: isLoadingTags } = useQuery<{ types: string[], effects: string[] }>({
    queryKey: ['/api/tags'],
  });

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const toggleEffect = (effectId: string) => {
    if (selectedEffects.includes(effectId)) {
      onEffectsChange(selectedEffects.filter(e => e !== effectId));
    } else {
      onEffectsChange([...selectedEffects, effectId]);
    }
  };

  // Build tea types array
  const teaTypes = (tags?.types || []).map(type => ({ id: type, label: type }));

  // Build effects array - case-insensitive matching
  const effectsList = (tags?.effects || []).map(effect => ({
    id: effect.toLowerCase(),
    label: effect
  }));

  // Helper function to display selected items
  const getDisplayText = (items: string[], allItems: { id: string; label: string }[]) => {
    if (items.length === 0) {
      return "Нет выбранных значений";
    }
    
    const labels = items.map(id => {
      const item = allItems.find(i => i.id === id || i.id === id.toLowerCase());
      return item?.label || id;
    });

    if (labels.length === 1) {
      return labels[0];
    }

    return labels.slice(0, 2).join(", ") + (labels.length > 2 ? "..." : "");
  };

  // Show loading state
  if (isLoadingTags) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Загрузка фильтров...
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Поиск */}
      {!isSearchOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSearchOpen(true)}
          data-testid="button-open-search"
        >
          <Search className="w-4 h-4 mr-2" />
          Поиск
        </Button>
      ) : (
        <div className="relative flex-1 min-w-[280px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Поиск чая..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={() => {
              if (!searchTerm) {
                setIsSearchOpen(false);
              }
            }}
            className="pl-9 text-base h-9"
            data-testid="input-search"
          />
        </div>
      )}

      {/* Квиз */}
      <Button
        onClick={onQuizClick}
        variant="outline"
        size="sm"
        className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 gap-1.5 transition-all duration-300"
        data-testid="button-open-quiz"
      >
        <Sparkles className="w-4 h-4" />
        Подобрать чай
      </Button>

      {/* Фильтр: Тип чая */}
      <Popover 
        open={openFilter === "types"} 
        onOpenChange={(open) => setOpenFilter(open ? "types" : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 justify-between min-w-[140px]"
            data-testid="button-filter-types"
          >
            <span className="text-sm truncate">Тип чая</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openFilter === "types" ? "rotate-180" : ""}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <div className="text-sm font-medium">Тип чая</div>
            <div className="text-xs text-muted-foreground mb-2">
              {getDisplayText(selectedTypes, teaTypes)}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {teaTypes.map((type) => (
                <label
                  key={type.id}
                  className="flex items-center gap-2 cursor-pointer hover-elevate p-1.5 rounded"
                  data-testid={`checkbox-type-${type.id}`}
                >
                  <Checkbox
                    checked={selectedTypes.includes(type.id)}
                    onCheckedChange={() => toggleType(type.id)}
                  />
                  <Badge 
                    className="text-xs"
                    style={getTeaTypeBadgeStyleDynamic(type.label, teaTypesFromAPI)}
                  >
                    {type.label}
                  </Badge>
                </label>
              ))}
            </div>
            {selectedTypes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTypesChange([])}
                className="w-full"
                data-testid="button-clear-types"
              >
                Очистить
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Фильтр: Эффекты */}
      {effectsList.length > 0 && (
        <Popover 
          open={openFilter === "effects"} 
          onOpenChange={(open) => setOpenFilter(open ? "effects" : null)}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 justify-between min-w-[140px]"
              data-testid="button-filter-effects"
            >
              <span className="text-sm truncate">Эффекты</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${openFilter === "effects" ? "rotate-180" : ""}`} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Эффекты</div>
              <div className="text-xs text-muted-foreground mb-2">
                {getDisplayText(selectedEffects, effectsList)}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {effectsList.map((effect) => (
                  <label
                    key={effect.id}
                    className="flex items-center gap-2 cursor-pointer hover-elevate p-1.5 rounded"
                    data-testid={`checkbox-effect-${effect.id}`}
                  >
                    <Checkbox
                      checked={selectedEffects.includes(effect.id)}
                      onCheckedChange={() => toggleEffect(effect.id)}
                    />
                    <span className="text-sm">{effect.label}</span>
                  </label>
                ))}
              </div>
              {selectedEffects.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEffectsChange([])}
                  className="w-full"
                  data-testid="button-clear-effects"
                >
                  Очистить
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
