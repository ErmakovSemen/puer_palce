import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { getTeaTypeColor } from "@/lib/teaColors";
import { useState } from "react";

interface ProductCardProps {
  id: number;
  name: string;
  pricePerGram: number;
  description: string;
  image?: string;  // Keep for backwards compatibility
  images?: string[];
  teaType: string;
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
  effects, 
  onAddToCart, 
  onClick 
}: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Use images array if available, otherwise fallback to single image
  const imageList = images && images.length > 0 ? images : (image ? [image] : []);
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
      className="overflow-hidden hover-elevate transition-all duration-200 cursor-pointer" 
      data-testid={`card-product-${id}`}
      onClick={() => onClick(id)}
    >
      <div className="h-48 overflow-hidden relative group">
        {imageList.length > 0 ? (
          <>
            <img 
              src={imageList[currentImageIndex]} 
              alt={name}
              className="w-full h-full object-cover transition-opacity"
              data-testid={`img-product-${id}`}
            />
            
            {/* Navigation arrows - only show if multiple images */}
            {hasMultipleImages && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={prevImage}
                  data-testid={`button-prev-image-${id}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
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
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <h3 className="font-serif text-xl font-semibold text-foreground" data-testid={`text-product-name-${id}`}>
            {name}
          </h3>
          <div className="flex flex-wrap gap-1">
            <Badge 
              className={`text-xs ${getTeaTypeColor(teaType)}`}
              data-testid={`badge-tea-type-${id}`}
            >
              {teaType}
            </Badge>
            {effects.map((effect, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs"
                data-testid={`badge-effect-${id}-${index}`}
              >
                {effect}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2" data-testid={`text-product-description-${id}`}>
          {description}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl font-semibold text-primary" data-testid={`text-product-price-${id}`}>
            {pricePerGram} ₽/г
          </span>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(id);
            }}
            className="bg-primary text-primary-foreground border border-primary-border"
            data-testid={`button-add-to-cart-${id}`}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            В корзину
          </Button>
        </div>
      </div>
    </Card>
  );
}
