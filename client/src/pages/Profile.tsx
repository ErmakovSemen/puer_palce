import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Package, Mail, Phone, Home, Edit, Save, X, FileText } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserSchema, type UpdateUser } from "@shared/schema";
import { LoyaltyProgressBar } from "@/components/LoyaltyProgressBar";
import { LoyaltyLevelsModal } from "@/components/LoyaltyLevelsModal";

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

                  return (
                    <Card key={order.id} data-testid={`card-order-${order.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">
                              Заказ №{order.id}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-order-date-${order.id}`}>
                              {orderDate}
                            </p>
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
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
