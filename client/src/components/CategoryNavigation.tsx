import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface CategoryNavigationProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  hasTeaware: boolean;
}

export default function CategoryNavigation({ 
  activeCategory, 
  onCategoryChange,
  hasTeaware 
}: CategoryNavigationProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const categories = [
    { id: "all", label: "ВСЕ" },
    { id: "teaware", label: "ЧАЙНАЯ ПОСУДА", show: hasTeaware },
  ].filter(cat => cat.show !== false);

  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);
      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [hasTeaware]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative mb-6">
      <div className="flex items-center gap-2">
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("left")}
            className="absolute left-0 z-10 bg-background/80 backdrop-blur-sm"
            data-testid="button-scroll-left"
          >
            ←
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-8 md:px-0"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange(category.id)}
              className={`whitespace-nowrap font-medium ${
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : ""
              }`}
              data-testid={`button-category-${category.id}`}
            >
              {category.label}
            </Button>
          ))}
        </div>

        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("right")}
            className="absolute right-0 z-10 bg-background/80 backdrop-blur-sm"
            data-testid="button-scroll-right"
          >
            →
          </Button>
        )}
      </div>
    </div>
  );
}
