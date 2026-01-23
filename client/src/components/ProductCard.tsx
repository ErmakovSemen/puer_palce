import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { getTeaTypeBadgeStyleDynamic } from "@/lib/tea-colors";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import fallbackImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";
import { useTeaTypes } from "@/hooks/use-tea-types";

interface ProductCardProps {
  id: number;
  name: string;
  category?: string;
  pricePerGram: number;
  description: string;
  image?: string;  // Keep for backwards compatibility
  images?: string[];
  teaType: string;
  effects: string[];
  availableQuantities?: string[];
  fixedQuantityOnly?: boolean;
  fixedQuantity?: number | null;
  outOfStock?: boolean;
  isInCart?: boolean;
  cartQuantity?: number; // Current quantity in cart (grams or pieces)
  cartPricePerUnit?: number; // Effective price per unit in cart (may include discount)
  cartOriginalPrice?: number; // Original price per unit (without discount)
  onAddToCart: (id: number, quantity: number, pricePerUnit: number) => void;
  onUpdateQuantity?: (id: number, quantity: number) => void;
  onClick: (id: number) => void;
  onFilterByType?: (type: string) => void;
  onFilterByEffect?: (effect: string) => void;
}

export default function ProductCard({ 
  id, 
  name, 
  category = "tea",
  pricePerGram, 
  description, 
  image,
  images,
  teaType,
  effects,
  availableQuantities = ["25", "50", "100"],
  fixedQuantityOnly = false,
  fixedQuantity = null,
  outOfStock = false,
  isInCart = false,
  cartQuantity = 0,
  cartPricePerUnit,
  cartOriginalPrice,
  onAddToCart,
  onUpdateQuantity,
  onClick,
  onFilterByType,
  onFilterByEffect
}: ProductCardProps) {
  const isTeaware = category === "teaware";
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const { data: teaTypes } = useTeaTypes();
  const [, setLocation] = useLocation();
  
  // Handle tag click - filter by type or effect
  const handleTagClick = (e: React.MouseEvent, filterType: 'teaType' | 'effect', value: string) => {
    e.stopPropagation();
    if (filterType === 'teaType' && onFilterByType) {
      onFilterByType(value);
    } else if (filterType === 'effect' && onFilterByEffect) {
      onFilterByEffect(value);
    } else {
      // Fallback to URL navigation if callbacks not provided
      const param = filterType === 'teaType' ? 'type' : 'effect';
      setLocation(`/?${param}=${encodeURIComponent(value)}`);
    }
  };
  
  // Parse available quantities and get min/max for tea products
  const parsedQuantities = useMemo(() => {
    if (isTeaware || fixedQuantityOnly) return [];
    return availableQuantities
      .map(q => parseInt(q, 10))
      .filter(q => !isNaN(q))
      .sort((a, b) => a - b);
  }, [availableQuantities, isTeaware, fixedQuantityOnly]);
  
  const minWeight = parsedQuantities.length > 0 ? parsedQuantities[0] : 100;
  const maxWeight = parsedQuantities.length > 1 ? parsedQuantities[parsedQuantities.length - 1] : minWeight;
  const hasWeightOptions = !isTeaware && !fixedQuantityOnly && minWeight !== maxWeight;
  
  // State for selected weight (default to min)
  const [selectedWeight, setSelectedWeight] = useState<'min' | 'max'>('min');
  
  // Calculate prices
  const currentWeight = selectedWeight === 'min' ? minWeight : maxWeight;
  const basePrice = pricePerGram * currentWeight;
  const BULK_DISCOUNT = 0.10; // 10% discount for quantities >= 100g
  const showDiscount = !isTeaware && currentWeight >= 100;
  const discountedPrice = showDiscount ? Math.round(basePrice * (1 - BULK_DISCOUNT)) : basePrice;
  
  // Use images array if available, otherwise fallback to single image or default
  const imageList = images && images.length > 0 ? images : (image ? [image] : [fallbackImage]);
  const hasMultipleImages = imageList.length > 1;
  
  // Reset error when image index changes or product changes
  useEffect(() => {
    setImageError(false);
  }, [currentImageIndex, id]);
  
  const handleImageError = () => {
    setImageError(true);
  };

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
      className="overflow-hidden hover-elevate transition-all duration-300 cursor-pointer group/card flex flex-col h-full" 
      data-testid={`card-product-${id}`}
      onClick={() => onClick(id)}
    >
      <div className="h-36 sm:h-48 overflow-hidden relative group flex-shrink-0">
        {imageList.length > 0 ? (
          <>
            <img 
              src={imageError ? fallbackImage : imageList[currentImageIndex]} 
              alt={name}
              className="w-full h-full object-cover transition-all duration-300 group-hover/card:scale-105 group-hover/card:brightness-105"
              onError={handleImageError}
              crossOrigin="anonymous"
              data-testid={`img-product-${id}`}
            />
            
            {/* Navigation arrows - only show if multiple images */}
            {hasMultipleImages && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 opacity-0 sm:group-hover:opacity-100 sm:opacity-0 opacity-100 transition-opacity h-11 w-11 sm:h-8 sm:w-8"
                  onClick={prevImage}
                  data-testid={`button-prev-image-${id}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 opacity-0 sm:group-hover:opacity-100 sm:opacity-0 opacity-100 transition-opacity h-11 w-11 sm:h-8 sm:w-8"
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
      <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 flex-grow">
        <div className="space-y-1.5 sm:space-y-2">
          <h3 className="font-serif text-base sm:text-xl font-semibold text-foreground line-clamp-2" data-testid={`text-product-name-${id}`}>
            {name}
          </h3>
          <div className="flex flex-wrap gap-1">
            <Badge 
              className="text-xs transition-all duration-300 cursor-pointer"
              style={getTeaTypeBadgeStyleDynamic(teaType, teaTypes)}
              onClick={(e) => handleTagClick(e, 'teaType', teaType)}
              data-testid={`badge-tea-type-${id}`}
            >
              {teaType}
            </Badge>
            {outOfStock && (
              <Badge 
                variant="outline" 
                className="text-xs transition-all duration-300 bg-destructive/10 text-destructive border-destructive"
                data-testid={`badge-out-of-stock-${id}`}
              >
                Нет в наличии
              </Badge>
            )}
            {effects.slice(0, 2).map((effect, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs transition-all duration-300 cursor-pointer"
                style={{ 
                  backgroundColor: 'white',
                  color: 'black',
                  border: '3px double black'
                }}
                onClick={(e) => handleTagClick(e, 'effect', effect)}
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
        
        {/* Weight toggle for tea products */}
        {hasWeightOptions && !outOfStock && (
          <div className="flex items-center gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedWeight('min')}
              className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-md transition-all ${
                selectedWeight === 'min'
                  ? 'bg-stone-100 text-foreground border border-stone-300'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              data-testid={`button-weight-min-${id}`}
            >
              {minWeight} г
            </button>
            <button
              type="button"
              onClick={() => setSelectedWeight('max')}
              className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-md transition-all relative ${
                selectedWeight === 'max'
                  ? 'bg-stone-100 text-foreground border border-stone-300'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              data-testid={`button-weight-max-${id}`}
            >
              {maxWeight} г
              {maxWeight >= 100 && (
                <span className="absolute -top-2 -right-1 text-[10px] font-bold text-green-600 bg-green-100 px-1 rounded">
                  -10%
                </span>
              )}
            </button>
          </div>
        )}
        
        {/* Price and cart controls */}
        <div className={`flex items-center gap-2 ${hasWeightOptions ? '' : 'mt-auto'}`}>
          {!outOfStock ? (
            isInCart && onUpdateQuantity ? (
              /* In-cart controls: -/price/+ and count */
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-1.5 w-full">
                  <div 
                    className="flex items-center flex-1 btn-gradient rounded-lg overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-none text-white no-default-hover-elevate no-default-active-elevate"
                      onClick={() => {
                        const step = isTeaware ? 1 : currentWeight;
                        const newQty = Math.max(0, cartQuantity - step);
                        onUpdateQuantity(id, newQty);
                      }}
                      data-testid={`button-decrease-${id}`}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <div className="flex-1 text-center py-1 px-1 min-w-[45px]">
                      <span className="text-white font-bold text-[11px] whitespace-nowrap" data-testid={`text-product-price-${id}`}>
                        {Math.round((cartPricePerUnit ?? pricePerGram) * cartQuantity)}₽
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-none text-white no-default-hover-elevate no-default-active-elevate"
                      onClick={() => {
                        const step = isTeaware ? 1 : currentWeight;
                        onUpdateQuantity(id, cartQuantity + step);
                      }}
                      data-testid={`button-increase-${id}`}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-muted-foreground text-xs whitespace-nowrap shrink-0" data-testid={`text-cart-count-${id}`}>
                    {isTeaware ? `x${cartQuantity}` : `${cartQuantity}г`}
                  </span>
                </div>
              </div>
            ) : (
              /* Not in cart: show price and add button */
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex flex-col" data-testid={`text-product-price-${id}`}>
                  {showDiscount && (
                    <span className="text-xs text-muted-foreground line-through">{basePrice} ₽</span>
                  )}
                  <span className="text-lg sm:text-xl font-semibold transition-colors duration-300 text-foreground group-hover/card:text-primary">
                    {isTeaware ? `${pricePerGram} ₽` : (
                      hasWeightOptions || fixedQuantityOnly ? `${discountedPrice} ₽` : `${pricePerGram} ₽/г`
                    )}
                  </span>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    const qty = isTeaware ? 1 : (
                      fixedQuantityOnly && fixedQuantity 
                        ? fixedQuantity 
                        : currentWeight
                    );
                    const effectivePrice = showDiscount ? pricePerGram * (1 - BULK_DISCOUNT) : pricePerGram;
                    onAddToCart(id, qty, effectivePrice);
                  }}
                  size="icon"
                  className="bg-black text-white border-2 border-white opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 shadow-lg transition-all duration-300"
                  data-testid={`button-add-to-cart-${id}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              </div>
            )
          ) : (
            /* Out of stock */
            <span className="text-lg sm:text-xl font-semibold text-muted-foreground" data-testid={`text-product-price-${id}`}>
              {isTeaware ? `${pricePerGram} ₽` : `${pricePerGram} ₽/г`}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
