import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Package, Mail, Phone, Home } from "lucide-react";

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

  const { data: orders = [], isLoading: isOrdersLoading } = useQuery<DbOrder[]>({
    queryKey: ['/api/orders'],
    enabled: !!user,
  });

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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="outline" size="default" data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />
              Пуэр Паб
            </Button>
          </Link>
          <h1 className="font-serif text-3xl md:text-4xl font-bold" data-testid="text-profile-title">
            Личный кабинет
          </h1>
        </div>

        {/* User Profile Card */}
        <Card className="mb-8" data-testid="card-user-profile">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Профиль
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span data-testid="text-user-email">{user?.email}</span>
            </div>
            {user?.name && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span data-testid="text-user-name">{user.name}</span>
              </div>
            )}
            {user?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span data-testid="text-user-phone">{user.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Section */}
        <div>
          <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-2">
            <Package className="w-6 h-6" />
            История заказов
          </h2>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground" data-testid="text-no-orders">
                  У вас пока нет заказов
                </p>
              </CardContent>
            </Card>
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
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            Заказ №{order.id}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`text-order-date-${order.id}`}>
                            {orderDate}
                          </p>
                        </div>
                        <Badge className="bg-primary text-primary-foreground border-[3px] border-double border-black" data-testid={`badge-order-total-${order.id}`}>
                          {order.total.toFixed(2)} ₽
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Order Items */}
                      <div>
                        <h4 className="font-semibold mb-2">Товары:</h4>
                        <div className="space-y-2">
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

                      <Separator />

                      {/* Delivery Info */}
                      <div>
                        <h4 className="font-semibold mb-2">Доставка:</h4>
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
      </div>
    </div>
  );
}
