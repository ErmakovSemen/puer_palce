import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import ProductCard from "./ProductCard";
import { Sparkles } from "lucide-react";

interface RecommendedProductsProps {
  onAddToCart: (id: number, quantity: number) => void;
  onProductClick: (id: number) => void;
}

export default function RecommendedProducts({ onAddToCart, onProductClick }: RecommendedProductsProps) {
  const { data: recommendations, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/recommendations"],
  });

  if (isLoading) {
    return null;
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-amber-500" />
        <h2 className="font-serif text-2xl font-semibold" data-testid="heading-recommendations">
          Рекомендуем вам
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {recommendations.slice(0, 4).map((product) => (
          <ProductCard
            key={product.id}
            {...product}
            onAddToCart={onAddToCart}
            onClick={onProductClick}
          />
        ))}
      </div>
    </div>
  );
}
