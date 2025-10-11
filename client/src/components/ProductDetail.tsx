import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { getTeaTypeColor } from "@/lib/teaColors";

interface ProductDetailProps {
  id: number;
  name: string;
  pricePerGram: number;
  description: string;
  image: string;
  teaType: string;
  effects: string[];
  onAddToCart: (id: number) => void;
  onClose: () => void;
}

export default function ProductDetail({
  id,
  name,
  pricePerGram,
  description,
  image,
  teaType,
  effects,
  onAddToCart,
  onClose,
}: ProductDetailProps) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="overflow-hidden rounded-md">
          <img
            src={image}
            alt={name}
            className="w-full h-auto object-cover"
            data-testid={`img-detail-product-${id}`}
          />
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="font-serif text-3xl font-bold mb-3" data-testid={`text-detail-name-${id}`}>
              {name}
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge 
                className={`text-sm ${getTeaTypeColor(teaType)}`}
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
                {pricePerGram} ₽/г
              </span>
              <span className="text-sm text-muted-foreground">
                (100 г = {pricePerGram * 100} ₽)
              </span>
            </div>

            <Button
              onClick={() => {
                onAddToCart(id);
                onClose();
              }}
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
