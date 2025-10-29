import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShoppingCart } from "lucide-react";
import { getTeaTypeColor } from "@/lib/teaColors";
import { useState } from "react";

interface ProductDetailProps {
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
  onAddToCart: (id: number, quantity: number) => void;
  onClose: () => void;
}

export default function ProductDetail({
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
  onAddToCart,
  onClose,
}: ProductDetailProps) {
  const isTeaware = category === "teaware";
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState<string>(
    fixedQuantityOnly && fixedQuantity ? String(fixedQuantity) : (availableQuantities[0] || "100")
  );
  const [customQuantity, setCustomQuantity] = useState<string>("");
  
  // Use images array if available, otherwise fallback to single image
  const imageList = images && images.length > 0 ? images : (image ? [image] : []);
  
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Image Gallery */}
        <div className="space-y-3">
          {/* Main image */}
          <div className="overflow-hidden rounded-md">
            {imageList.length > 0 ? (
              <img
                src={imageList[selectedImageIndex]}
                alt={name}
                className="w-full h-auto max-h-64 md:max-h-none object-contain"
                data-testid={`img-detail-product-${id}`}
              />
            ) : (
              <div className="w-full h-64 md:h-96 bg-muted flex items-center justify-center rounded-md">
                <p className="text-muted-foreground">Нет изображения</p>
              </div>
            )}
          </div>
          
          {/* Thumbnail strip - only show if multiple images */}
          {imageList.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {imageList.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`overflow-hidden rounded-md border-2 transition-all ${
                    index === selectedImageIndex 
                      ? 'border-primary' 
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                  data-testid={`button-thumbnail-${id}-${index}`}
                >
                  <img
                    src={img}
                    alt={`${name} ${index + 1}`}
                    className="w-full h-16 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-4">
          <div>
            <h2 className="font-serif text-3xl font-bold mb-3" data-testid={`text-detail-name-${id}`}>
              {name}
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge 
                className="text-sm text-white"
                style={{
                  backgroundColor: teaTypeColor || getTeaTypeColor(teaType),
                  border: '3px double black'
                }}
                data-testid={`badge-detail-tea-type-${id}`}
              >
                {teaType}
              </Badge>
              {effects.map((effect, index) => (
                <Badge 
                  key={index} 
                  variant="outline"
                  className="text-sm"
                  data-testid={`badge-detail-effect-${id}-${index}`}
                >
                  {effect}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-muted-foreground leading-relaxed" data-testid={`text-detail-description-${id}`}>
            {description}
          </p>

          <div className="pt-4 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary" data-testid={`text-detail-price-${id}`}>
                {isTeaware ? `${pricePerGram} ₽` : `${pricePerGram} ₽/г`}
              </span>
              {!isTeaware && (
                <span className="text-sm text-muted-foreground">
                  (100 г = {pricePerGram * 100} ₽)
                </span>
              )}
            </div>

            {/* Quantity Selection - not shown for teaware */}
            {!isTeaware && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Количество</label>
                
                {fixedQuantityOnly && fixedQuantity ? (
                  <>
                    {/* Fixed quantity only - show as info */}
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground mb-2">
                        Данный чай продаётся только в фиксированном количестве:
                      </p>
                      <p className="text-2xl font-bold text-primary" data-testid="text-fixed-quantity">
                        {fixedQuantity}г
                      </p>
                    </div>
                    
                    {/* Total price */}
                    <div className="text-right">
                      <span className="text-lg font-semibold" data-testid="text-total-price">
                        Итого: {pricePerGram * fixedQuantity} ₽
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Preset quantities */}
                    <div className="flex flex-wrap gap-2">
                      {availableQuantities.map((qty) => (
                        <Button
                          key={qty}
                          type="button"
                          variant={selectedQuantity === qty && !customQuantity ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedQuantity(qty);
                            setCustomQuantity("");
                          }}
                          data-testid={`button-quantity-${qty}`}
                        >
                          {qty}г
                        </Button>
                      ))}
                    </div>

                    {/* Custom quantity input */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">Своё количество (г)</label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Введите количество"
                          value={customQuantity}
                          onChange={(e) => {
                            setCustomQuantity(e.target.value);
                            setSelectedQuantity("");
                          }}
                          data-testid="input-custom-quantity"
                        />
                      </div>
                    </div>

                    {/* Total price */}
                    {(selectedQuantity || customQuantity) && (
                      <div className="text-right">
                        <span className="text-lg font-semibold" data-testid="text-total-price">
                          Итого: {pricePerGram * parseInt(customQuantity || selectedQuantity || "0", 10)} ₽
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <Button
              onClick={() => {
                // For teaware, always add 1 piece
                const quantity = isTeaware ? 1 : (
                  fixedQuantityOnly && fixedQuantity 
                    ? fixedQuantity 
                    : parseInt(customQuantity || selectedQuantity || "0", 10)
                );
                if (quantity > 0) {
                  onAddToCart(id, quantity);
                  onClose();
                }
              }}
              disabled={!isTeaware && !fixedQuantityOnly && !selectedQuantity && !customQuantity}
              className="w-full bg-primary text-primary-foreground border border-primary-border"
              size="lg"
              data-testid={`button-detail-add-to-cart-${id}`}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Добавить в корзину
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
