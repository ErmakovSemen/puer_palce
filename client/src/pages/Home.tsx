import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import ProductFilters from "@/components/ProductFilters";
import CartDrawer from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import TeaQuiz from "@/components/TeaQuiz";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Product } from "@shared/schema";

// Fallback image for products without images
import fallbackImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export default function Home() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description?.toLowerCase() ?? "").includes(searchTerm.toLowerCase());
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(product.teaType);
      const matchesEffects = selectedEffects.length === 0 || 
        selectedEffects.some(effect => 
          product.effects.some(productEffect => 
            productEffect.toLowerCase() === effect.toLowerCase()
          )
        );
      return matchesSearch && matchesType && matchesEffects;
    });
  }, [products, searchTerm, selectedTypes, selectedEffects]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const addToCart = (productId: number, quantityInGrams: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCartItems(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing) {
        return prev.map(item =>
          item.id === productId
            ? { ...item, quantity: item.quantity + quantityInGrams }
            : item
        );
      }
      return [...prev, { 
        id: product.id,
        name: product.name, 
        price: product.pricePerGram,
        quantity: quantityInGrams,
        image: product.images[0]
      }];
    });

    toast({
      title: "Добавлено в корзину",
      description: `${product.name} (${quantityInGrams}г)`,
    });
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity === 0) {
      setCartItems(prev => prev.filter(item => item.id !== id));
    } else {
      setCartItems(prev =>
        prev.map(item => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const removeItem = (id: number) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedTypes([]);
    setSelectedEffects([]);
  };

  const handleCheckout = () => {
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    if (total < 500) {
      toast({
        title: "Минимальная сумма заказа 500₽",
        description: `Текущая сумма: ${Math.round(total)}₽. Добавьте товаров еще на ${Math.round(500 - total)}₽`,
        variant: "destructive",
      });
      return;
    }
    
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      setCartItems([]);
      setIsCheckoutOpen(false);
      setIsSuccessDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка при оформлении заказа",
        description: error.message || "Попробуйте еще раз",
        variant: "destructive",
      });
    },
  });

  const handleOrderSubmit = (data: any) => {
    // Transform cart items to match order schema
    const orderItems = cartItems.map(item => {
      const product = products.find((p: Product) => p.id === item.id);
      return {
        id: item.id,
        name: item.name,
        pricePerGram: product?.pricePerGram || 0,
        quantity: item.quantity, // Already in grams
      };
    });

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    orderMutation.mutate({
      ...data,
      items: orderItems,
      total,
    });
  };

  const handleQuizRecommend = (teaType: string) => {
    // Устанавливаем фильтр по типу чая (используем название напрямую)
    setSelectedTypes([teaType]);
    
    toast({
      title: "Подбор завершён!",
      description: `Мы рекомендуем вам ${teaType}`,
    });
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen">
      <Header
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
        onLogoClick={resetFilters}
      />
      
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="mb-6">
          <ProductFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedTypes={selectedTypes}
            onTypesChange={setSelectedTypes}
            selectedEffects={selectedEffects}
            onEffectsChange={setSelectedEffects}
            onQuizClick={() => setIsQuizOpen(true)}
          />
        </div>

        {/* Decorative divider with Chinese meander elements */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 border-2 border-black" style={{ borderRadius: 0 }} />
          <div className="flex-1 h-px bg-black" />
          <div className="w-2 h-2 border-2 border-black" style={{ borderRadius: 0 }} />
        </div>

        <div className="flex items-end justify-end mb-2">
          <p className="text-sm text-muted-foreground" data-testid="text-products-count">
            Найдено: {filteredProducts.length}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              Загрузка...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg" data-testid="text-no-results">
              Ничего не найдено. Попробуйте изменить фильтры.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                onAddToCart={addToCart}
                onClick={setSelectedProductId}
              />
            ))}
          </div>
        )}
      </div>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onCheckout={handleCheckout}
      />

      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Оформление заказа</DialogTitle>
            <DialogDescription>
              Заполните форму, и мы свяжемся с вами для подтверждения заказа
            </DialogDescription>
          </DialogHeader>
          <CheckoutForm
            onSubmit={handleOrderSubmit}
            onCancel={() => setIsCheckoutOpen(false)}
            isSubmitting={orderMutation.isPending}
            user={user}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={selectedProductId !== null} onOpenChange={(open) => !open && setSelectedProductId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Детали товара</DialogTitle>
            <DialogDescription className="sr-only">
              Подробная информация о чае
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <ProductDetail
              {...selectedProduct}
              onAddToCart={addToCart}
              onClose={() => setSelectedProductId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuizOpen} onOpenChange={setIsQuizOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Подбор чая</DialogTitle>
            <DialogDescription className="sr-only">
              Ответьте на 3 вопроса, чтобы мы подобрали для вас идеальный чай
            </DialogDescription>
          </DialogHeader>
          <TeaQuiz
            onClose={() => setIsQuizOpen(false)}
            onRecommend={handleQuizRecommend}
          />
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-order-success">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-center">
              Заказ успешно оформлен!
            </DialogTitle>
            <DialogDescription className="text-center">
              Мы свяжемся с вами в ближайшее время для подтверждения заказа
            </DialogDescription>
          </DialogHeader>
          
          {!user && (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground text-center">
                Создайте аккаунт, чтобы отслеживать заказы и получать бонусы в программе лояльности
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSuccessDialogOpen(false)}
                  className="flex-1"
                  data-testid="button-close-success"
                >
                  Закрыть
                </Button>
                <Button
                  asChild
                  className="flex-1 bg-primary text-primary-foreground border border-primary-border"
                  data-testid="button-goto-register"
                >
                  <Link href="/auth">
                    Создать аккаунт
                  </Link>
                </Button>
              </div>
            </div>
          )}
          
          {user && (
            <div className="pt-4">
              <Button
                onClick={() => setIsSuccessDialogOpen(false)}
                className="w-full bg-primary text-primary-foreground border border-primary-border"
                data-testid="button-close-success"
              >
                Отлично
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
