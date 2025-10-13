import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { getTeaTypeColor } from "@/lib/teaColors";
import { useState } from "react";
import fallbackImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

interface ProductCardProps {
  id: number;
  name: string;
  pricePerGram: number;
  description: string;
  image?: string;  // Keep for backwards compatibility
  images?: string[];
  teaType: string;
  teaTypeColor?: string;
  effects: string[];
  onAddToCart: (id: number) => void;
  onClick: (id: number) => void;
}

export default function ProductCard({ 
  id, 
  name, 
  pricePerGram, 
  description, 
  image,
  images,
  teaType,
  teaTypeColor = "#8B4513",
  effects, 
  onAddToCart, 
  onClick 
}: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Use images array if available, otherwise fallback to single image or default
  const imageList = images && images.length > 0 ? images : (image ? [image] : [fallbackImage]);
  const hasMultipleImages = imageList.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % imageList.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
  };

  return (
    <Card 
      className="overflow-hidden hover-elevate transition-all duration-300 cursor-pointer group/card" 
      data-testid={`card-product-${id}`}
      onClick={() => onClick(id)}
    >
      <div className="h-36 sm:h-48 overflow-hidden relative group">
        {imageList.length > 0 ? (
          <>
            <img 
              src={imageList[currentImageIndex]} 
              alt={name}
              className="w-full h-full object-cover transition-all duration-300 group-hover/card:scale-105 group-hover/card:brightness-105"
              data-testid={`img-product-${id}`}
            />
            
            {/* Navigation arrows - only show if multiple images */}
            {hasMultipleImages && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 opacity-0 sm:group-hover:opacity-100 sm:opacity-0 opacity-100 transition-opacity h-11 w-11 sm:h-8 sm:w-8"
                  onClick={prevImage}
                  data-testid={`button-prev-image-${id}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 opacity-0 sm:group-hover:opacity-100 sm:opacity-0 opacity-100 transition-opacity h-11 w-11 sm:h-8 sm:w-8"
                  onClick={nextImage}
                  data-testid={`button-next-image-${id}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                
                {/* Dots indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {imageList.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 w-1.5 rounded-full transition-all ${
                        index === currentImageIndex 
                          ? 'bg-primary w-3' 
                          : 'bg-background/60'
                      }`}
                      data-testid={`dot-indicator-${id}-${index}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Нет изображения</p>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <div className="space-y-1.5 sm:space-y-2">
          <h3 className="font-serif text-base sm:text-xl font-semibold text-foreground line-clamp-2" data-testid={`text-product-name-${id}`}>
            {name}
          </h3>
          <div className="flex flex-wrap gap-1">
            <Badge 
              className="text-xs transition-all duration-300 text-white border-0"
              style={{
                backgroundColor: teaTypeColor
              }}
              data-testid={`badge-tea-type-${id}`}
            >
              {teaType}
            </Badge>
            {effects.slice(0, 2).map((effect, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs transition-all duration-300 group-hover/card:opacity-100 opacity-60"
                data-testid={`badge-effect-${id}-${index}`}
              >
                {effect}
              </Badge>
            ))}
          </div>
        </div>
        <p className="hidden text-muted-foreground text-sm leading-relaxed line-clamp-2" data-testid={`text-product-description-${id}`}>
          {description}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg sm:text-xl font-semibold transition-colors duration-300 text-foreground group-hover/card:text-primary" data-testid={`text-product-price-${id}`}>
            {pricePerGram} ₽/г
          </span>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(id);
            }}
            size="icon"
            className="bg-primary text-primary-foreground border border-primary-border opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 h-8 w-8"
            data-testid={`button-add-to-cart-${id}`}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
