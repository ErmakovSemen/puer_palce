import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { getTeaTypeColor } from "@/lib/teaColors";

interface ProductCardProps {
  id: number;
  name: string;
  pricePerGram: number;
  description: string;
  image: string;
  teaType: string;
  effects: string[];
  onAddToCart: (id: number) => void;
  onClick: (id: number) => void;
}

export default function ProductCard({ id, name, pricePerGram, description, image, teaType, effects, onAddToCart, onClick }: ProductCardProps) {
  return (
    <Card 
      className="overflow-hidden hover-elevate transition-all duration-200 cursor-pointer" 
      data-testid={`card-product-${id}`}
      onClick={() => onClick(id)}
    >
      <div className="h-48 overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover"
          data-testid={`img-product-${id}`}
        />
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
