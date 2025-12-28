import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Product } from "@shared/schema";
import ProductCard from "./ProductCard";
import { Sparkles } from "lucide-react";

interface CartItemInfo {
  quantity: number;
  pricePerUnit: number;
  originalPrice: number;
}

interface RecommendedProductsProps {
  onAddToCart: (id: number, quantity: number) => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onProductClick: (id: number) => void;
  cartItems: Map<number, CartItemInfo>;
  onRecommendationsLoaded?: (productIds: number[]) => void;
}

export default function RecommendedProducts({ 
  onAddToCart, 
  onUpdateQuantity,
  onProductClick, 
  cartItems,
  onRecommendationsLoaded
}: RecommendedProductsProps) {
  const { data: recommendations, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/recommendations"],
  });

  // Notify parent about loaded recommendation IDs (including empty state)
  const notifiedRef = useRef<string>("");
  useEffect(() => {
    if (onRecommendationsLoaded) {
      const ids = (recommendations && recommendations.length > 0) 
        ? recommendations.slice(0, 4).map(p => p.id)
        : [];
      const idsKey = ids.join(",");
      if (notifiedRef.current !== idsKey) {
        notifiedRef.current = idsKey;
        onRecommendationsLoaded(ids);
      }
    }
  }, [recommendations, onRecommendationsLoaded]);

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
        {recommendations.slice(0, 4).map((product) => {
          const cartInfo = cartItems.get(product.id);
          return (
            <div key={product.id} className="h-full">
              <ProductCard
                {...product}
                isInCart={!!cartInfo}
                cartQuantity={cartInfo?.quantity || 0}
                cartPricePerUnit={cartInfo?.pricePerUnit}
                cartOriginalPrice={cartInfo?.originalPrice}
                onAddToCart={onAddToCart}
                onUpdateQuantity={onUpdateQuantity}
                onClick={onProductClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
