import { X, Minus, Plus, Trash2, Gift, Star, Crown, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoyaltyDiscount, getLoyaltyLevel } from "@shared/loyalty";

interface CartItem {
  id: number;
  name: string;
  category?: string;
  price: number;
  originalPrice: number;
  quantity: number;
  image: string;
}

interface UserInfo {
  xp: number;
  phoneVerified: boolean;
  firstOrderDiscountUsed: boolean;
  customDiscount?: number | null;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveItem: (id: number) => void;
  onCheckout: () => void;
  user?: UserInfo | null;
}

export default function CartDrawer({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onRemoveItem,
  onCheckout,
  user
}: CartDrawerProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const originalTotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  
  const bulkDiscountAmount = originalTotal - subtotal;
  
  let runningTotal = subtotal;
  
  const canGetFirstOrderDiscount = user && !user.firstOrderDiscountUsed;
  const firstOrderDiscountAmount = canGetFirstOrderDiscount ? runningTotal * 0.20 : 0;
  if (canGetFirstOrderDiscount) {
    runningTotal = runningTotal - firstOrderDiscountAmount;
  }
  
  const loyaltyDiscount = (user && user.phoneVerified) ? getLoyaltyDiscount(user.xp) : 0;
  const loyaltyLevel = user ? getLoyaltyLevel(user.xp) : null;
  const loyaltyDiscountAmount = (runningTotal * loyaltyDiscount) / 100;
  runningTotal = runningTotal - loyaltyDiscountAmount;
  
  const customDiscount = user?.customDiscount || 0;
  const customDiscountAmount = (runningTotal * customDiscount) / 100;
  runningTotal = runningTotal - customDiscountAmount;
  
  const finalTotal = Math.max(runningTotal, 0);
  
  const hasAnyDiscount = bulkDiscountAmount > 0 || firstOrderDiscountAmount > 0 || loyaltyDiscountAmount > 0 || customDiscountAmount > 0;

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
            <div className="flex-1 overflow-y-auto p-6">
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
                        <div className="flex items-center gap-2" data-testid={`text-cart-item-price-${item.id}`}>
                          {item.originalPrice && item.price < item.originalPrice && (
                            <span className="text-white/50 line-through text-sm">{Math.round(item.originalPrice * item.quantity)} ₽</span>
                          )}
                          <span className="text-white font-semibold">{Math.round(item.price * item.quantity)} ₽</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.category === "teaware" ? (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                                onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                                data-testid={`button-decrease-${item.id}`}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-16 text-center text-sm text-white" data-testid={`text-quantity-${item.id}`}>{item.quantity} шт</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                data-testid={`button-increase-${item.id}`}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                                onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 25))}
                                data-testid={`button-decrease-${item.id}`}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-16 text-center text-sm text-white" data-testid={`text-quantity-${item.id}`}>{item.quantity}г</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 25)}
                                data-testid={`button-increase-${item.id}`}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 ml-auto text-white/70 hover:text-white hover:bg-white/10"
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
            </div>

            <div className="border-t border-white/10 p-6 space-y-3">
              {hasAnyDiscount && (
                <div className="space-y-2 pb-3 border-b border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Сумма товаров:</span>
                    <span className="text-white/60">{Math.round(originalTotal)} ₽</span>
                  </div>
                  
                  {bulkDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm" data-testid="discount-bulk">
                      <span className="text-green-400 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5" />
                        Скидка за объём (от 100г)
                      </span>
                      <span className="text-green-400">−{Math.round(bulkDiscountAmount)} ₽</span>
                    </div>
                  )}
                  
                  {firstOrderDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm" data-testid="discount-first-order">
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5" />
                        Скидка на первый заказ (20%)
                      </span>
                      <span className="text-amber-400">−{Math.round(firstOrderDiscountAmount)} ₽</span>
                    </div>
                  )}
                  
                  {loyaltyDiscountAmount > 0 && loyaltyLevel && (
                    <div className="flex items-center justify-between text-sm" data-testid="discount-loyalty">
                      <span className="text-purple-400 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" />
                        {loyaltyLevel.name} ({loyaltyDiscount}%)
                      </span>
                      <span className="text-purple-400">−{Math.round(loyaltyDiscountAmount)} ₽</span>
                    </div>
                  )}
                  
                  {customDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm" data-testid="discount-custom">
                      <span className="text-cyan-400 flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5" />
                        Персональная скидка ({customDiscount}%)
                      </span>
                      <span className="text-cyan-400">−{Math.round(customDiscountAmount)} ₽</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">Итого:</span>
                <div className="flex items-center gap-2">
                  {hasAnyDiscount && (
                    <span className="text-white/50 line-through text-lg">{Math.round(originalTotal)} ₽</span>
                  )}
                  <span className="text-2xl font-bold text-white" data-testid="text-cart-total">{Math.round(finalTotal)} ₽</span>
                </div>
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
