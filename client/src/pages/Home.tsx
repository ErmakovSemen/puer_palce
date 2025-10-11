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

// todo: remove mock functionality
import teaImage1 from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";
import teaImage2 from "@assets/stock_images/puer_tea_leaves_clos_fe9c6a5d.jpg";
import teaImage3 from "@assets/stock_images/puer_tea_leaves_clos_7ea94bda.jpg";
import teaImage4 from "@assets/stock_images/various_types_of_loo_32fadc10.jpg";
import teaImage5 from "@assets/stock_images/various_types_of_loo_6f6a1381.jpg";

const mockProducts = [
  { id: 1, name: "Шу Пуэр Императорский", pricePerGram: 12, description: "Выдержанный темный пуэр с глубоким землистым вкусом", images: [teaImage1, teaImage2, teaImage3], type: "shu", teaType: "Шу Пуэр", effects: ["Бодрит", "Согревает"] },
  { id: 2, name: "Шен Пуэр Дикий", pricePerGram: 15, description: "Свежий зеленый пуэр с цветочными нотами", images: [teaImage2, teaImage3], type: "shen", teaType: "Шен Пуэр", effects: ["Концентрирует", "Освежает"] },
  { id: 3, name: "Лао Шу Гу Шу", pricePerGram: 20, description: "Пуэр из древних чайных деревьев", images: [teaImage3, teaImage4, teaImage5], type: "aged", teaType: "Шен Пуэр", effects: ["Успокаивает", "Концентрирует"] },
  { id: 4, name: "Да И Шу Пуэр", pricePerGram: 13, description: "Классический шу пуэр с мягким вкусом", images: [teaImage4], type: "shu", teaType: "Шу Пуэр", effects: ["Бодрит"] },
  { id: 5, name: "Юннань Габа", pricePerGram: 14, description: "Молодой шен пуэр с освежающим вкусом", images: [teaImage5, teaImage1], type: "shen", teaType: "Габа", effects: ["Успокаивает", "Расслабляет"] },
  { id: 6, name: "Пуэр Бин Ча", pricePerGram: 18, description: "Прессованный пуэр в форме блина", images: [teaImage1, teaImage2], type: "aged", teaType: "Шу Пуэр", effects: ["Бодрит", "Согревает"] },
  { id: 7, name: "Мэнхай Шу", pricePerGram: 11, description: "Классический шу пуэр из Мэнхая", images: [teaImage2, teaImage3, teaImage4], type: "shu", teaType: "Шу Пуэр", effects: ["Бодрит"] },
  { id: 8, name: "Иу Шен", pricePerGram: 19, description: "Элитный шен пуэр из региона Иу", images: [teaImage3], type: "shen", teaType: "Шен Пуэр", effects: ["Концентрирует", "Освежает"] },
  { id: 9, name: "Красный Пуэр", pricePerGram: 22, description: "Премиальный красный пуэр из Банчжана", images: [teaImage4, teaImage5], type: "aged", teaType: "Красный", effects: ["Бодрит", "Согревает", "Тонизирует"] },
  { id: 10, name: "Булан Шен", pricePerGram: 16, description: "Горный шен пуэр с насыщенным вкусом", images: [teaImage5, teaImage1, teaImage2], type: "shen", teaType: "Шен Пуэр", effects: ["Концентрирует"] },
  { id: 11, name: "Габа Алишань", pricePerGram: 12.5, description: "Туо ча классической формы", images: [teaImage1], type: "shu", teaType: "Габа", effects: ["Успокаивает", "Расслабляет"] },
  { id: 12, name: "Гу Шу Ча", pricePerGram: 25, description: "Чай с древних деревьев премиум класса", images: [teaImage2, teaImage4, teaImage5], type: "aged", teaType: "Шен Пуэр", effects: ["Успокаивает", "Концентрирует", "Медитативный"] },
];

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
  const [selectedType, setSelectedType] = useState("all");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const { toast } = useToast();

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesType = selectedType === "all" || product.type === selectedType;
      const matchesEffects = selectedEffects.length === 0 || 
        selectedEffects.some(effect => 
          product.effects.some(productEffect => 
            productEffect.toLowerCase() === effect.toLowerCase()
          )
        );
      return matchesType && matchesEffects;
    });
  }, [selectedType, selectedEffects]);

  const selectedProduct = mockProducts.find(p => p.id === selectedProductId);

  const addToCart = (productId: number) => {
    const product = mockProducts.find(p => p.id === productId);
    if (!product) return;

    setCartItems(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing) {
        return prev.map(item =>
          item.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        id: product.id,
        name: product.name, 
        price: product.pricePerGram * 100,
        quantity: 1,
        image: product.images[0]
      }];
    });

    toast({
      title: "Добавлено в корзину",
      description: product.name,
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

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderSubmit = (data: any) => {
    console.log("Order submitted:", { ...data, items: cartItems });
    toast({
      title: "Заказ оформлен!",
      description: "Мы свяжемся с вами в ближайшее время",
    });
    setCartItems([]);
    setIsCheckoutOpen(false);
  };

  const handleQuizRecommend = (teaType: string) => {
    // Устанавливаем фильтр по типу чая
    const typeMap: { [key: string]: string } = {
      "Шу Пуэр": "shu",
      "Шен Пуэр": "shen",
      "Габа": "shen",
      "Красный": "aged",
    };
    
    const typeValue = typeMap[teaType] || "all";
    setSelectedType(typeValue);
    
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
      />
      
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="mb-6">
          <ProductFilters
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedEffects={selectedEffects}
            onEffectsChange={setSelectedEffects}
            onQuizClick={() => setIsQuizOpen(true)}
          />
        </div>

        <div className="flex items-end justify-end mb-2">
          <p className="text-sm text-muted-foreground" data-testid="text-products-count">
            Найдено: {filteredProducts.length}
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg" data-testid="text-no-results">
              Ничего не найдено. Попробуйте изменить фильтры.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
          />
        </DialogContent>
      </Dialog>

      <Dialog open={selectedProductId !== null} onOpenChange={(open) => !open && setSelectedProductId(null)}>
        <DialogContent className="max-w-4xl">
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
    </div>
  );
}
