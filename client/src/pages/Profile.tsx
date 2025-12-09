import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Package, Mail, Phone, Home, Edit, Save, X, FileText, CheckCircle, AlertCircle, Gift, ShoppingBag, Sparkles, MapPin } from "lucide-react";
import type { Product } from "@shared/schema";
import { useState } from "react";
import { SavedAddresses } from "@/components/SavedAddresses";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserSchema, type UpdateUser } from "@shared/schema";
import { LoyaltyProgressBar } from "@/components/LoyaltyProgressBar";
import { LoyaltyLevelsModal } from "@/components/LoyaltyLevelsModal";
import { TelegramLink } from "@/components/TelegramLink";

interface DbOrder {
  id: number;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  comment: string | null;
  items: string;
  total: number;
  createdAt: string;
  status: string;
  paymentId: string | null;
  paymentStatus: string | null;
  paymentUrl: string | null;
  receiptEmail: string | null;
}

interface OrderItem {
  id: number;
  name: string;
  pricePerGram: number;
  quantity: number;
}

export default function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  const form = useForm<UpdateUser>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
    },
  });

  const { data: orders = [], isLoading: isOrdersLoading } = useQuery<DbOrder[]>({
    queryKey: ['/api/orders'],
    enabled: !!user,
  });

  const { data: recommendations = [] } = useQuery<Product[]>({
    queryKey: ['/api/recommendations'],
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUser) => {
      return await apiRequest('PUT', '/api/user', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsEditing(false);
      toast({
        title: "Профиль обновлен",
        description: "Ваши данные успешно сохранены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить профиль",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = () => {
    form.reset({
      name: user?.name || "",
      phone: user?.phone || "",
    });
    setIsEditing(true);
  };

  const handleSaveClick = form.handleSubmit((data) => {
    updateProfileMutation.mutate(data);
  });

  const handleCancelClick = () => {
    setIsEditing(false);
    form.reset();
  };

  // Redirect to auth if not logged in
  if (!isAuthLoading && !user) {
    return <Redirect to="/auth" />;
  }

  if (isAuthLoading || isOrdersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" size="default" data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />
              Пуэр Паб
            </Button>
          </Link>
        </div>

        {/* User Profile Section */}
        <div className="mb-8">
          {/* Username */}
          <h1 className="font-serif text-3xl font-bold mb-4 flex items-center gap-3" data-testid="text-username">
            <User className="w-8 h-8" />
            {user?.name || user?.email || "Пользователь"}
          </h1>

          {/* Loyalty Progress Bar */}
          {user && (
            <div className="mb-6">
              <LoyaltyProgressBar 
                xp={user.xp} 
                onClick={() => setShowLoyaltyModal(true)}
              />
            </div>
          )}

          {/* First Order Discount Banner - Main Profile Page */}
          {user && !user.firstOrderDiscountUsed && (
            <div className="mb-6 bg-gradient-to-br from-amber-100 to-yellow-100 border-2 border-amber-400 rounded-lg p-6 shadow-md" data-testid="banner-first-order-discount-main">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-shrink-0 bg-amber-500 rounded-full p-4">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-amber-900 mb-2">
                    Скидка 20% на первый заказ
                  </h3>
                  <p className="text-sm text-amber-800 mb-0 sm:mb-0">
                    Оформите свой первый заказ и получите скидку 20%!
                  </p>
                </div>
                <Link href="/">
                  <Button 
                    size="default" 
                    className="bg-amber-600 hover:bg-amber-700 text-white border-amber-700 w-full sm:w-auto"
                    data-testid="button-shop-discount"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    В магазин
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              size="default"
              onClick={() => setShowProfileModal(true)}
              data-testid="button-view-profile"
              className="hover-elevate active-elevate-2"
            >
              <FileText className="w-4 h-4 mr-2" />
              Личные данные
            </Button>

            <Button 
              variant="outline" 
              size="default"
              onClick={() => setShowAddressesModal(true)}
              data-testid="button-view-addresses"
              className="hover-elevate active-elevate-2"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Мои адреса
            </Button>

            <Button 
              variant="default" 
              size="default"
              onClick={() => setShowOrdersModal(true)}
              data-testid="button-view-orders"
              className="hover-elevate active-elevate-2"
            >
              <Package className="w-4 h-4 mr-2" />
              История заказов
              {orders.length > 0 && (
                <Badge className="ml-2 bg-background text-foreground border-[3px] border-double border-black">
                  {orders.length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Personalized Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div className="mt-8">
              <Card data-testid="card-recommendations">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                    <h3 className="font-serif text-xl font-semibold">
                      Персональные рекомендации
                    </h3>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    На основе вашей истории покупок мы подобрали {recommendations.length} {
                      recommendations.length === 1 ? 'товар' :
                      recommendations.length < 5 ? 'товара' : 'товаров'
                    }, которые могут вам понравиться
                  </p>
                  <Link href="/">
                    <Button 
                      variant="default" 
                      size="default"
                      className="w-full sm:w-auto"
                      data-testid="button-view-recommendations"
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Посмотреть рекомендации
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Telegram Integration */}
          <div className="mt-8">
            <TelegramLink />
          </div>
        </div>
      </div>

      {/* Profile Details Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-xl" data-testid="dialog-profile-details">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Личные данные
              </DialogTitle>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  data-testid="button-edit-profile"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelClick}
                    data-testid="button-cancel-edit"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateProfileMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {/* First Order Discount Banner */}
          {user && !user.firstOrderDiscountUsed && (
            <div className="mt-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg p-4" data-testid="banner-first-order-discount">
              <div className="flex items-start gap-3">
                <Gift className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">
                    Скидка 20% на первый заказ
                  </h3>
                  <p className="text-sm text-amber-800 mb-3">
                    Вы получите скидку 20% при оформлении вашего первого заказа. 
                    Не упустите возможность попробовать наш премиальный чай по специальной цене!
                  </p>
                  <Link href="/shop">
                    <Button 
                      size="sm" 
                      className="bg-amber-600 hover:bg-amber-700 text-white border-amber-700"
                      data-testid="button-shop-now"
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Перейти в магазин
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span data-testid="text-user-email">{user?.email}</span>
            </div>
            
            {/* Name - editable */}
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              {isEditing ? (
                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Введите имя"
                            data-testid="input-edit-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Form>
              ) : (
                <span data-testid="text-user-name">{user?.name || "Не указано"}</span>
              )}
            </div>
            
            {/* Phone - editable */}
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {isEditing ? (
                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Введите телефон"
                            data-testid="input-edit-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Form>
              ) : (
                <span data-testid="text-user-phone">{user?.phone || "Не указано"}</span>
              )}
            </div>

            {/* Phone Verification Status */}
            {!isEditing && user && (
              <div className="flex items-center gap-3 ml-7">
                {user.phoneVerified ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Телефон подтверждён
                  </Badge>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      Телефон не подтверждён
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Подтвердите телефон для получения скидок программы лояльности
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Orders History Modal */}
      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-orders">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              История заказов
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {orders.length === 0 ? (
              <div className="py-8">
                <p className="text-center text-muted-foreground" data-testid="text-no-orders">
                  У вас пока нет заказов
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const items: OrderItem[] = JSON.parse(order.items);
                  const orderDate = new Date(order.createdAt).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Determine payment status label
                  const getPaymentStatusInfo = () => {
                    if (order.status === "cancelled") {
                      return { label: "Отменён", variant: "destructive" as const };
                    }
                    if (!order.paymentId || !order.paymentStatus) {
                      return { label: "Ожидает оплаты", variant: "secondary" as const };
                    }
                    if (order.paymentStatus === "CONFIRMED") {
                      return { label: "Оплачен", variant: "default" as const };
                    }
                    if (order.paymentStatus === "REJECTED") {
                      return { label: "Отклонён", variant: "destructive" as const };
                    }
                    return { label: "Ожидает оплаты", variant: "secondary" as const };
                  };

                  const paymentStatus = getPaymentStatusInfo();
                  const canPay = order.status !== "cancelled" && order.paymentStatus !== "CONFIRMED";

                  return (
                    <Card key={order.id} data-testid={`card-order-${order.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              Заказ №{order.id}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-order-date-${order.id}`}>
                              {orderDate}
                            </p>
                            <Badge variant={paymentStatus.variant} className="mt-2" data-testid={`badge-payment-status-${order.id}`}>
                              {paymentStatus.label}
                            </Badge>
                          </div>
                          <Badge className="bg-primary text-primary-foreground border-[3px] border-double border-black" data-testid={`badge-order-total-${order.id}`}>
                            {order.total.toFixed(2)} ₽
                          </Badge>
                        </div>

                        {/* Order Items */}
                        <div className="mb-3">
                          <h4 className="font-semibold mb-2 text-sm">Товары:</h4>
                          <div className="space-y-1">
                            {items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-sm"
                                data-testid={`item-${order.id}-${idx}`}
                              >
                                <span className="flex-1">
                                  {item.name} ({item.quantity}г)
                                </span>
                                <span className="text-muted-foreground">
                                  {(item.pricePerGram * item.quantity).toFixed(2)} ₽
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator className="my-3" />

                        {/* Delivery Info */}
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">Доставка:</h4>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-muted-foreground">Получатель:</span>{" "}
                              {order.name}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Телефон:</span>{" "}
                              {order.phone}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Email:</span>{" "}
                              {order.email}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Адрес:</span>{" "}
                              {order.address}
                            </p>
                            {order.comment && (
                              <p>
                                <span className="text-muted-foreground">Комментарий:</span>{" "}
                                {order.comment}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pay Button for unpaid orders */}
                        {canPay && (
                          <div className="mt-4">
                            <Separator className="mb-4" />
                            <Button
                              onClick={async () => {
                                try {
                                  const response = await fetch("/api/payments/init", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ orderId: order.id }),
                                  });
                                  const data = await response.json();
                                  if (data.success && data.paymentUrl) {
                                    window.location.href = data.paymentUrl;
                                  } else {
                                    toast({
                                      title: "Ошибка",
                                      description: "Не удалось инициировать платёж",
                                      variant: "destructive",
                                    });
                                  }
                                } catch (error) {
                                  console.error("Payment initialization error:", error);
                                  toast({
                                    title: "Ошибка",
                                    description: "Не удалось инициировать платёж",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="w-full bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
                              data-testid={`button-pay-order-${order.id}`}
                            >
                              Оплатить заказ
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Saved Addresses Modal */}
      <Dialog open={showAddressesModal} onOpenChange={setShowAddressesModal}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto" data-testid="dialog-addresses">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Мои адреса
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <SavedAddresses />
          </div>
        </DialogContent>
      </Dialog>

      {/* Loyalty Levels Modal */}
      {user && (
        <LoyaltyLevelsModal
          open={showLoyaltyModal}
          onOpenChange={setShowLoyaltyModal}
          currentXP={user.xp}
        />
      )}
    </div>
  );
}
