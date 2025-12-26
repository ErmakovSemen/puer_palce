import { useState, useMemo, useRef, useEffect } from "react";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import ProductFilters from "@/components/ProductFilters";
import CategoryNavigation from "@/components/CategoryNavigation";
import CartDrawer from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import TeaQuiz from "@/components/TeaQuiz";
import RecommendedProducts from "@/components/RecommendedProducts";
import { BannerSlot } from "@/components/InfoBanner";
import type { InfoBanner } from "@shared/schema";
import { getLoyaltyDiscount } from "@shared/loyalty";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Product } from "@shared/schema";

// Fallback image for products without images
import fallbackImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

interface CartItem {
  id: number; // productId for display/matching
  cartItemId?: number; // DB cart item ID (only for authenticated users)
  name: string;
  category?: string;
  price: number;
  quantity: number;
  image: string;
}

// Type for cart data from API
interface ApiCartItem {
  id: number;
  userId: string;
  productId: number;
  quantity: number;
  addedAt: string;
  product: Product;
}

// Helper component to render product grid with between-rows banners
interface ProductGridWithBannersProps {
  products: Product[];
  banners: InfoBanner[];
  cartProductIds: number[];
  onAddToCart: (productId: number, quantity: number) => void;
  onProductClick: (productId: number) => void;
}

function ProductGridWithBanners({ products, banners, cartProductIds, onAddToCart, onProductClick }: ProductGridWithBannersProps) {
  const DESKTOP_COLS = 4;
  const MOBILE_COLS = 2;

  const desktopRows: Product[][] = [];
  const mobileRows: Product[][] = [];

  for (let i = 0; i < products.length; i += DESKTOP_COLS) {
    desktopRows.push(products.slice(i, i + DESKTOP_COLS));
  }
  for (let i = 0; i < products.length; i += MOBILE_COLS) {
    mobileRows.push(products.slice(i, i + MOBILE_COLS));
  }

  const hasBannersForRow = (rowIndex: number, isMobile: boolean) => {
    return banners.some(b => {
      const slot = isMobile ? b.mobileSlot : b.desktopSlot;
      const isHidden = isMobile ? b.hideOnMobile : b.hideOnDesktop;
      const bannerRowIndex = isMobile ? b.betweenRowIndexMobile : b.betweenRowIndexDesktop;
      return slot === "between_products" && !isHidden && b.isActive && bannerRowIndex === rowIndex;
    });
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden md:block">
        {desktopRows.map((row, rowIndex) => (
          <div key={rowIndex}>
            <div className="grid grid-cols-4 gap-6 mb-6">
              {row.map((product) => (
                <div key={product.id} className="h-full">
                  <ProductCard
                    {...product}
                    isInCart={cartProductIds.includes(product.id)}
                    onAddToCart={onAddToCart}
                    onClick={onProductClick}
                  />
                </div>
              ))}
            </div>
            {hasBannersForRow(rowIndex, false) && (
              <BannerSlot 
                slotId="between_products" 
                banners={banners} 
                betweenRowIndex={rowIndex}
                className="mb-6" 
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {mobileRows.map((row, rowIndex) => (
          <div key={rowIndex}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {row.map((product) => (
                <div key={product.id} className="h-full">
                  <ProductCard
                    {...product}
                    isInCart={cartProductIds.includes(product.id)}
                    onAddToCart={onAddToCart}
                    onClick={onProductClick}
                  />
                </div>
              ))}
            </div>
            {hasBannersForRow(rowIndex, true) && (
              <BannerSlot 
                slotId="between_products" 
                banners={banners} 
                betweenRowIndex={rowIndex}
                className="mb-3" 
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Home() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const { toast } = useToast();
  const { user } = useAuth();

  // Guest cart (localStorage for unauthenticated users)
  const [guestCartItems, setGuestCartItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('guestCart');
    return saved ? JSON.parse(saved) : [];
  });

  // Load cart from API for authenticated users
  const { data: apiCartItems = [], isLoading: isCartLoading } = useQuery<ApiCartItem[]>({
    queryKey: ['/api/cart'],
    enabled: !!user,
  });

  // Use DB cart for authenticated, localStorage for guests
  const cartItems: CartItem[] = user 
    ? apiCartItems.map(item => ({
        id: item.productId, // productId for display/matching
        cartItemId: item.id, // DB cart item ID for updates/deletes
        name: item.product.name,
        category: item.product.category,
        price: item.product.pricePerGram,
        quantity: item.quantity,
        image: item.product.images[0] || fallbackImage,
      }))
    : guestCartItems;

  // Save guest cart to localStorage
  useEffect(() => {
    if (!user) {
      localStorage.setItem('guestCart', JSON.stringify(guestCartItems));
    }
  }, [guestCartItems, user]);

  const teawareSectionRef = useRef<HTMLDivElement>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: banners = [] } = useQuery<InfoBanner[]>({
    queryKey: ['/api/banners'],
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

  // Split products by category
  const teaProducts = useMemo(() => {
    return filteredProducts.filter(p => p.category === "tea");
  }, [filteredProducts]);

  const teawareProducts = useMemo(() => {
    return filteredProducts.filter(p => p.category === "teaware");
  }, [filteredProducts]);

  const hasTeaware = teawareProducts.length > 0;

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Handle category change (scroll to section)
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    if (category === "teaware" && teawareSectionRef.current) {
      teawareSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Scroll observer to update active category
  useEffect(() => {
    if (!hasTeaware) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target === teawareSectionRef.current) {
            setActiveCategory("teaware");
          } else if (!entry.isIntersecting && entry.target === teawareSectionRef.current) {
            setActiveCategory("all");
          }
        });
      },
      { threshold: 0.3 }
    );

    if (teawareSectionRef.current) {
      observer.observe(teawareSectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasTeaware]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  // Mutation for adding items to cart
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return await apiRequest("POST", "/api/cart", { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
    onError: (error: any) => {
      toast({
        title: error.message === "Необходимо войти в систему" ? "Войдите чтобы добавить в корзину" : "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating cart item quantity
  const updateCartMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) => {
      return await apiRequest("PATCH", `/api/cart/${cartItemId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  // Mutation for removing item from cart
  const removeFromCartMutation = useMutation({
    mutationFn: async (cartItemId: number) => {
      return await apiRequest("DELETE", `/api/cart/${cartItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  const addToCart = (productId: number, quantityInGrams: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const isTeaware = product.category === "teaware";

    if (user) {
      // Authenticated: save to DB
      addToCartMutation.mutate(
        { productId, quantity: quantityInGrams },
        {
          onSuccess: () => {
            toast({
              title: "Добавлено в корзину",
              description: `${product.name} (${isTeaware ? quantityInGrams + ' шт' : quantityInGrams + 'г'})`,
            });
          },
        }
      );
    } else {
      // Guest: save to localStorage
      setGuestCartItems(prev => {
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
          category: product.category,
          price: product.pricePerGram,
          quantity: quantityInGrams,
          image: product.images[0] || fallbackImage
        }];
      });

      toast({
        title: "Добавлено в корзину",
        description: `${product.name} (${isTeaware ? quantityInGrams + ' шт' : quantityInGrams + 'г'})`,
      });
    }
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (user) {
      // Authenticated: update in DB
      const cartItem = cartItems.find(item => item.id === productId);
      if (!cartItem || !cartItem.cartItemId) return;

      if (quantity === 0) {
        removeFromCartMutation.mutate(cartItem.cartItemId);
      } else {
        updateCartMutation.mutate({ cartItemId: cartItem.cartItemId, quantity });
      }
    } else {
      // Guest: update localStorage
      if (quantity === 0) {
        setGuestCartItems(prev => prev.filter(item => item.id !== productId));
      } else {
        setGuestCartItems(prev =>
          prev.map(item => (item.id === productId ? { ...item, quantity } : item))
        );
      }
    }
  };

  const removeItem = (productId: number) => {
    if (user) {
      // Authenticated: remove from DB
      const cartItem = cartItems.find(item => item.id === productId);
      if (!cartItem || !cartItem.cartItemId) return;
      removeFromCartMutation.mutate(cartItem.cartItemId);
    } else {
      // Guest: remove from localStorage
      setGuestCartItems(prev => prev.filter(item => item.id !== productId));
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedTypes([]);
    setSelectedEffects([]);
  };

  const handleCheckout = () => {
    if (cartTotal < 500) {
      toast({
        title: "Минимальная сумма заказа 500₽",
        description: `Текущая сумма: ${Math.round(cartTotal)}₽. Добавьте товаров еще на ${Math.round(500 - cartTotal)}₽`,
        variant: "destructive",
      });
      return;
    }
    
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders", orderData);
      const data = await response.json();
      return data;
    },
    onSuccess: async (data: any) => {
      if (user) {
        // Authenticated: cart cleared on server, invalidate queries
        queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
        queryClient.invalidateQueries({ queryKey: ['/api/user'] }); // Update user data (firstOrderDiscountUsed)
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] }); // Update order history
      } else {
        // Guest: clear localStorage cart
        setGuestCartItems([]);
        localStorage.removeItem('guestCart');
      }
      
      setIsCheckoutOpen(false);
      
      // Initialize payment and redirect to Tinkoff payment page
      try {
        const paymentResponse = await apiRequest("POST", "/api/payments/init", {
          orderId: data.orderId,
        });
        const paymentData = await paymentResponse.json();
        
        if (paymentData.success && paymentData.paymentUrl) {
          // Redirect to Tinkoff payment page (all payment methods including SBP will be shown there)
          window.location.href = paymentData.paymentUrl;
        } else {
          throw new Error("Failed to initialize payment");
        }
      } catch (error) {
        console.error("Payment initialization error:", error);
        toast({
          title: "Ошибка инициализации платежа",
          description: "Не удалось перейти к оплате. Попробуйте позже.",
          variant: "destructive",
        });
      }
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

    // Apply loyalty discount only if user is authenticated AND phone is verified
    const discount = (user && user.phoneVerified) ? getLoyaltyDiscount(user.xp) : 0;
    const discountAmount = (cartTotal * discount) / 100;
    const finalTotal = cartTotal - discountAmount;

    orderMutation.mutate({
      ...data,
      items: orderItems,
      total: finalTotal,
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

  const cartItemCount = cartItems.length;
  const cartProductIds = useMemo(() => cartItems.map(item => item.id), [cartItems]);

  return (
    <div className="min-h-screen">
      <Header
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
        onLogoClick={resetFilters}
      />
      
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-4">
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

        {/* Banner slot: after filters */}
        <BannerSlot slotId="after_filters" banners={banners} className="mb-6" />

        {/* Category Navigation */}
        {hasTeaware && (
          <CategoryNavigation
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            hasTeaware={hasTeaware}
          />
        )}

        {/* Banner slot: before products */}
        <BannerSlot slotId="before_products" banners={banners} className="mb-6" />

        {/* Decorative divider with Chinese meander elements */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 border-2 border-black rounded-sm" />
          <div className="flex-1 h-px bg-black" />
          <div className="w-2 h-2 border-2 border-black rounded-sm" />
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
          <>
            {/* Recommendations based on purchase history */}
            {user && (
              <RecommendedProducts
                onAddToCart={addToCart}
                onProductClick={setSelectedProductId}
              />
            )}

            {/* Tea Products with between-rows banners */}
            {teaProducts.length > 0 && (
              <div className="mb-12">
                <h2 className="font-serif text-2xl font-semibold mb-4" data-testid="heading-tea-section">
                  Все товары
                </h2>
                <ProductGridWithBanners
                  products={teaProducts}
                  banners={banners}
                  cartProductIds={cartProductIds}
                  onAddToCart={addToCart}
                  onProductClick={setSelectedProductId}
                />
              </div>
            )}

            {/* Banner slot: after tea products */}
            <BannerSlot slotId="after_products" banners={banners} className="mb-8" />

            {/* Teaware Products */}
            {teawareProducts.length > 0 && (
              <div ref={teawareSectionRef} className="scroll-mt-20">
                <h2 className="font-serif text-2xl font-semibold mb-4" data-testid="heading-teaware-section">
                  Чайная посуда
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {teawareProducts.map((product) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        {...product}
                        isInCart={cartProductIds.includes(product.id)}
                        onAddToCart={addToCart}
                        onClick={setSelectedProductId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
            total={cartTotal}
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
