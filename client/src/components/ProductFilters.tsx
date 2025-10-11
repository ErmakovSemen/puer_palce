import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductFiltersProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedEffects: string[];
  onEffectsChange: (effects: string[]) => void;
  onQuizClick: () => void;
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
  selectedType,
  onTypeChange,
  selectedEffects,
  onEffectsChange,
  onQuizClick,
}: ProductFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleEffect = (effectId: string) => {
    if (selectedEffects.includes(effectId)) {
      onEffectsChange(selectedEffects.filter(e => e !== effectId));
    } else {
      onEffectsChange([...selectedEffects, effectId]);
    }
  };

  // Разделим эффекты на основные и дополнительные
  const primaryEffects = effects.slice(0, 3);
  const secondaryEffects = effects.slice(3);

  return (
    <div className="space-y-2">
      {/* Первая строка: квиз, типы чая, основные эффекты */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Кнопка квиза */}
        <Badge
          onClick={onQuizClick}
          className="cursor-pointer bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover-elevate active-elevate-2 gap-1.5"
          data-testid="button-open-quiz"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Подобрать чай
        </Badge>

        {/* Типы чая */}
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
