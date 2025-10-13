import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
    <div className="space-y-4">
      {/* Поиск и квиз */}
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
          <div className="relative flex-1 max-w-xs">
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
              className="pl-9"
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
      </div>

      {/* Категории фильтров */}
      <div className="space-y-3">
        {/* Типы чая */}
        <Collapsible defaultOpen>
          <div className="space-y-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
              <span>Тип чая</span>
              <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex items-center gap-2 flex-wrap">
                {teaTypes.map((type) => (
                  <Badge
                    key={type.id}
                    variant={selectedType === type.id ? "default" : "outline"}
                    className={`cursor-pointer hover-elevate active-elevate-2 transition-all duration-300 ${
                      selectedType === type.id 
                        ? "bg-primary text-primary-foreground border-primary-border" 
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ borderRadius: '0' }}
                    onClick={() => onTypeChange(selectedType === type.id ? "all" : type.id)}
                    data-testid={`button-filter-${type.id}`}
                  >
                    {type.label}
                  </Badge>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Эффекты */}
        {effectsList.length > 0 && (
          <Collapsible defaultOpen={false}>
            <div className="space-y-2">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
                <span>Эффекты</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {effectsList.map((effect) => (
                    <Badge
                      key={effect.id}
                      variant={selectedEffects.includes(effect.id) ? "default" : "outline"}
                      className={`cursor-pointer hover-elevate active-elevate-2 transition-all duration-300 ${
                        selectedEffects.includes(effect.id)
                          ? "bg-primary text-primary-foreground border-primary-border"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      style={{ borderRadius: '0' }}
                      onClick={() => toggleEffect(effect.id)}
                      data-testid={`button-effect-${effect.id}`}
                    >
                      {effect.label}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
