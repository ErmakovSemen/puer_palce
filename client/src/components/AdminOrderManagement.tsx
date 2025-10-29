import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, User, Mail, Phone, MapPin, MessageSquare } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { getApiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import type { DbOrder } from "@shared/schema";

interface AdminOrderManagementProps {
  adminPassword: string;
}

const STATUS_LABELS = {
  pending: "Не оплачен",
  paid: "Оплачен",
  cancelled: "Отменён",
  completed: "Завершён",
} as const;

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  paid: "default",
  cancelled: "destructive",
  completed: "outline",
};

export default function AdminOrderManagement({ adminPassword }: AdminOrderManagementProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  // Get all orders query
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['/api/admin/orders', statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? getApiUrl('/api/admin/orders')
        : getApiUrl(`/api/admin/orders?status=${statusFilter}`);
      
      const res = await fetch(url, {
        headers: { 'X-Admin-Password': adminPassword },
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to load orders');
      }
      return await res.json() as DbOrder[];
    },
  });

  const orders = ordersData || [];

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      const res = await fetch(getApiUrl(`/api/admin/orders/${orderId}/status`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update status');
      }
      return await res.json() as DbOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      toast({
        title: "Успешно",
        description: "Статус заказа обновлен",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить статус",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Загрузка заказов...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Управление заказами</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder="Фильтр по статусу" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все заказы</SelectItem>
                <SelectItem value="pending">Не оплачен</SelectItem>
                <SelectItem value="paid">Оплачен</SelectItem>
                <SelectItem value="cancelled">Отменён</SelectItem>
                <SelectItem value="completed">Завершён</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground">Нет заказов</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const items = JSON.parse(order.items);
                const orderDate = new Date(order.createdAt);
                
                return (
                  <Card key={order.id} data-testid={`card-order-${order.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Заказ #{order.id}</CardTitle>
                            <Badge variant={STATUS_VARIANTS[order.status]} data-testid={`badge-status-${order.id}`}>
                              {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(orderDate, 'd MMMM yyyy, HH:mm', { locale: ru })}
                          </p>
                        </div>
                        <Select
                          value={order.status}
                          onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger className="w-[160px]" data-testid={`select-status-${order.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Не оплачен</SelectItem>
                            <SelectItem value="paid">Оплачен</SelectItem>
                            <SelectItem value="cancelled">Отменён</SelectItem>
                            <SelectItem value="completed">Завершён</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Customer Info */}
                      <div className="grid gap-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Данные клиента
                        </h4>
                        <div className="grid gap-1 text-sm pl-6">
                          <p data-testid={`text-customer-name-${order.id}`}>
                            <span className="text-muted-foreground">Имя:</span> {order.name}
                          </p>
                          <p className="flex items-center gap-1" data-testid={`text-customer-email-${order.id}`}>
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {order.email}
                          </p>
                          <p className="flex items-center gap-1" data-testid={`text-customer-phone-${order.id}`}>
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {order.phone}
                          </p>
                          <p className="flex items-center gap-1" data-testid={`text-customer-address-${order.id}`}>
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {order.address}
                          </p>
                          {order.comment && (
                            <p className="flex items-center gap-1" data-testid={`text-customer-comment-${order.id}`}>
                              <MessageSquare className="h-3 w-3 text-muted-foreground" />
                              {order.comment}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="grid gap-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Состав заказа
                        </h4>
                        <div className="space-y-2 pl-6">
                          {items.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between text-sm" data-testid={`item-${order.id}-${index}`}>
                              <span>
                                {item.name} × {item.quantity}г
                              </span>
                              <span className="font-medium">
                                {(item.pricePerGram * item.quantity).toFixed(2)}₽
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-2 border-t font-medium" data-testid={`text-total-${order.id}`}>
                            <span>Итого:</span>
                            <span>{order.total.toFixed(2)}₽</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
