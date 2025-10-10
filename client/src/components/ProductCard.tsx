import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface ProductCardProps {
  id: number;
  name: string;
  pricePerGram: number;
  description: string;
  image: string;
  onAddToCart: (id: number) => void;
}

export default function ProductCard({ id, name, pricePerGram, description, image, onAddToCart }: ProductCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate transition-all duration-200" data-testid={`card-product-${id}`}>
      <div className="aspect-square overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover"
          data-testid={`img-product-${id}`}
        />
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-serif text-xl font-semibold text-foreground" data-testid={`text-product-name-${id}`}>
          {name}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2" data-testid={`text-product-description-${id}`}>
          {description}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl font-semibold text-primary" data-testid={`text-product-price-${id}`}>
            {pricePerGram} ₽/г
          </span>
          <Button
            onClick={() => onAddToCart(id)}
            className="bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
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
