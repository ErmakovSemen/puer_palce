import { X, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveItem: (id: number) => void;
  onCheckout: () => void;
}

export default function CartDrawer({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onRemoveItem,
  onCheckout 
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
        data-testid="overlay-cart"
      />
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-black text-white border-l border-white/10 z-50 flex flex-col" data-testid="drawer-cart">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="font-serif text-2xl font-semibold text-white" data-testid="text-cart-title">Корзина</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-cart"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-white/60 text-center" data-testid="text-empty-cart">
              Ваша корзина пуста
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id} className="p-4 bg-white/5 border-white/10" data-testid={`cart-item-${item.id}`}>
                    <div className="flex gap-4">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-md"
                        data-testid={`img-cart-item-${item.id}`}
                      />
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-sm text-white" data-testid={`text-cart-item-name-${item.id}`}>{item.name}</h3>
                        <p className="text-white font-semibold" data-testid={`text-cart-item-price-${item.id}`}>{item.price} ₽</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                            data-testid={`button-decrease-${item.id}`}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center" data-testid={`text-quantity-${item.id}`}>{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            data-testid={`button-increase-${item.id}`}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 ml-auto"
                            onClick={() => onRemoveItem(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">Итого:</span>
                <span className="text-2xl font-bold text-white" data-testid="text-cart-total">{total} ₽</span>
              </div>
              <Button
                className="w-full bg-white text-black hover:bg-white/90 border-0"
                onClick={onCheckout}
                data-testid="button-checkout"
              >
                Оформить заказ
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
