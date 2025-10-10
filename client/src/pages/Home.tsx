import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import ProductFilters from "@/components/ProductFilters";
import CartDrawer from "@/components/CartDrawer";
import CheckoutForm from "@/components/CheckoutForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// todo: remove mock functionality
import teaImage1 from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";
import teaImage2 from "@assets/stock_images/puer_tea_leaves_clos_fe9c6a5d.jpg";
import teaImage3 from "@assets/stock_images/puer_tea_leaves_clos_7ea94bda.jpg";
import teaImage4 from "@assets/stock_images/various_types_of_loo_32fadc10.jpg";
import teaImage5 from "@assets/stock_images/various_types_of_loo_6f6a1381.jpg";

const mockProducts = [
  { id: 1, name: "Шу Пуэр Императорский", price: 1200, description: "Выдержанный темный пуэр с глубоким землистым вкусом", image: teaImage1, type: "shu" },
  { id: 2, name: "Шен Пуэр Дикий", price: 1500, description: "Свежий зеленый пуэр с цветочными нотами", image: teaImage2, type: "shen" },
  { id: 3, name: "Лао Шу Гу Шу", price: 2000, description: "Пуэр из древних чайных деревьев", image: teaImage3, type: "aged" },
  { id: 4, name: "Да И Шу Пуэр", price: 1300, description: "Классический шу пуэр с мягким вкусом", image: teaImage4, type: "shu" },
  { id: 5, name: "Юннань Шен", price: 1400, description: "Молодой шен пуэр с освежающим вкусом", image: teaImage5, type: "shen" },
  { id: 6, name: "Пуэр Бин Ча", price: 1800, description: "Прессованный пуэр в форме блина", image: teaImage1, type: "aged" },
  { id: 7, name: "Мэнхай Шу", price: 1100, description: "Классический шу пуэр из Мэнхая", image: teaImage2, type: "shu" },
  { id: 8, name: "Иу Шен", price: 1900, description: "Элитный шен пуэр из региона Иу", image: teaImage3, type: "shen" },
  { id: 9, name: "Банчжан Шу", price: 2200, description: "Премиальный шу пуэр из Банчжана", image: teaImage4, type: "aged" },
  { id: 10, name: "Булан Шен", price: 1600, description: "Горный шен пуэр с насыщенным вкусом", image: teaImage5, type: "shen" },
  { id: 11, name: "Сягуань Точа", price: 1250, description: "Туо ча классической формы", image: teaImage1, type: "shu" },
  { id: 12, name: "Гу Шу Ча", price: 2500, description: "Чай с древних деревьев премиум класса", image: teaImage2, type: "aged" },
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
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 3000]);
  const [selectedType, setSelectedType] = useState("all");
  const { toast } = useToast();

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesType = selectedType === "all" || product.type === selectedType;
      return matchesSearch && matchesPrice && matchesType;
    });
  }, [searchTerm, priceRange, selectedType]);

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
      return [...prev, { ...product, quantity: 1 }];
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

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen">
      <Header
        cartItemCount={cartItemCount}
        onCartClick={() => setIsCartOpen(true)}
      />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <h2 className="font-serif text-2xl font-bold mb-6" data-testid="text-filters-title">
                Фильтры
              </h2>
              <ProductFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
              />
            </div>
          </aside>

          <main className="lg:col-span-3">
            <div className="mb-6">
              <h1 className="font-serif text-4xl font-bold mb-2" data-testid="text-catalog-title">
                Каталог чая
              </h1>
              <p className="text-muted-foreground" data-testid="text-products-count">
                Найдено товаров: {filteredProducts.length}
              </p>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg" data-testid="text-no-results">
                  Ничего не найдено. Попробуйте изменить фильтры.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    {...product}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
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
    </div>
  );
}
