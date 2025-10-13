import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedEffects: string[];
  onEffectsChange: (effects: string[]) => void;
  onQuizClick: () => void;
}

export default function ProductFilters({
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedEffects,
  onEffectsChange,
  onQuizClick,
}: ProductFiltersProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch dynamic tags from API
  const { data: tags, isLoading: isLoadingTags } = useQuery<{ types: string[], effects: string[] }>({
    queryKey: ['/api/tags'],
  });

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  const toggleEffect = (effectId: string) => {
    if (selectedEffects.includes(effectId)) {
      onEffectsChange(selectedEffects.filter(e => e !== effectId));
    } else {
      onEffectsChange([...selectedEffects, effectId]);
    }
  };

  // Build tea types array with "all" option
  const teaTypes = [
    { id: "all", label: "Все виды" },
    ...(tags?.types || []).map(type => ({ id: type, label: type }))
  ];

  // Build effects array - case-insensitive matching
  const effectsList = (tags?.effects || []).map(effect => ({
    id: effect.toLowerCase(),
    label: effect
  }));

  // Разделим эффекты на основные и дополнительные
  const primaryEffects = effectsList.slice(0, 3);
  const secondaryEffects = effectsList.slice(3);

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
    <div className="space-y-2">
      {/* Первая строка: поиск, квиз + типы чая (без gap), основные эффекты */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Поиск */}
        {!isSearchOpen ? (
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsSearchOpen(true)}
            data-testid="button-open-search"
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <div className="relative w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={() => {
                if (!searchTerm) {
                  setIsSearchOpen(false);
                }
              }}
              className="pl-8 h-7 text-sm"
              data-testid="input-search"
            />
          </div>
        )}

        {/* Кнопка квиза + типы чая (без пробела между ними) */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            onClick={onQuizClick}
            className="cursor-pointer bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover-elevate active-elevate-2 gap-1.5 -mr-1"
            data-testid="button-open-quiz"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Подобрать чай
          </Badge>

          {teaTypes.map((type) => (
            <Badge
              key={type.id}
              variant={selectedType === type.id ? "default" : "outline"}
              className={`cursor-pointer hover-elevate active-elevate-2 ${
                selectedType === type.id 
                  ? "bg-primary text-primary-foreground border-primary-border" 
                  : ""
              }`}
              onClick={() => onTypeChange(selectedType === type.id ? "all" : type.id)}
              data-testid={`button-filter-${type.id}`}
            >
              # {type.label}
            </Badge>
          ))}
        </div>

        {/* Основные эффекты */}
        {primaryEffects.map((effect) => (
          <Badge
            key={effect.id}
            variant={selectedEffects.includes(effect.id) ? "default" : "outline"}
            className={`cursor-pointer hover-elevate active-elevate-2 ${
              selectedEffects.includes(effect.id)
                ? "bg-primary text-primary-foreground border-primary-border"
                : ""
            }`}
            onClick={() => toggleEffect(effect.id)}
            data-testid={`button-effect-${effect.id}`}
          >
            # {effect.label}
          </Badge>
        ))}

        {/* Кнопка разворачивания */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 ml-auto"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="button-toggle-filters"
        >
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Вторая строка: дополнительные эффекты (collapsible) */}
      {isExpanded && (
        <div className="flex items-center gap-2 flex-wrap">
          {secondaryEffects.map((effect) => (
            <Badge
              key={effect.id}
              variant={selectedEffects.includes(effect.id) ? "default" : "outline"}
              className={`cursor-pointer hover-elevate active-elevate-2 ${
                selectedEffects.includes(effect.id)
                  ? "bg-primary text-primary-foreground border-primary-border"
                  : ""
              }`}
              onClick={() => toggleEffect(effect.id)}
              data-testid={`button-effect-${effect.id}`}
            >
              # {effect.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
