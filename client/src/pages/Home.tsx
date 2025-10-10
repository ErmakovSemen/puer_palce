import { useState } from "react";
import Hero from "@/components/Hero";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
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
  { id: 1, name: "Шу Пуэр Императорский", price: 1200, description: "Выдержанный темный пуэр с глубоким землистым вкусом и нотками сухофруктов", image: teaImage1 },
  { id: 2, name: "Шен Пуэр Дикий", price: 1500, description: "Свежий зеленый пуэр с цветочными нотами и легкой сладостью", image: teaImage2 },
  { id: 3, name: "Лао Шу Гу Шу", price: 2000, description: "Пуэр из древних чайных деревьев с насыщенным и многогранным вкусом", image: teaImage3 },
  { id: 4, name: "Да И Шу Пуэр", price: 1300, description: "Классический шу пуэр с мягким вкусом и ароматом земли", image: teaImage4 },
  { id: 5, name: "Юннань Шен", price: 1400, description: "Молодой шен пуэр с освежающим вкусом и медовыми нотками", image: teaImage5 },
  { id: 6, name: "Пуэр Бин Ча", price: 1800, description: "Прессованный пуэр в форме блина с богатым вкусом", image: teaImage1 },
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
  const { toast } = useToast();

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
      <Hero />
      
      <section id="catalog" className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-serif text-4xl md:text-5xl font-bold text-center mb-12" data-testid="text-catalog-title">
          Наша коллекция
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockProducts.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              onAddToCart={addToCart}
            />
          ))}
        </div>
      </section>

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
