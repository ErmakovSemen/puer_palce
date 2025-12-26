import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, Trophy, Copy, Check } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getLoyaltyProgress, LOYALTY_LEVELS } from "@shared/loyalty";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { getApiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import type { User, DbOrder } from "@shared/schema";

interface UserWithoutPassword extends Omit<User, 'password'> {}

interface AdminUserManagementProps {
  adminPassword: string;
}

export default function AdminUserManagement({ adminPassword }: AdminUserManagementProps) {
  const [searchPhone, setSearchPhone] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [xpAmount, setXpAmount] = useState<string>("100");
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [showRecentUsers, setShowRecentUsers] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyLeaderboardLink = async () => {
    const url = `${window.location.origin}/admin/leaderboard`;
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast({
        title: "Ссылка скопирована",
        description: "Ссылка на лидерборд скопирована в буфер обмена",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
        variant: "destructive",
      });
    }
  };

  // Recent users query
  const { data: recentUsers, isLoading: isLoadingRecent } = useQuery({
    queryKey: ['/api/admin/users/recent'],
    enabled: showRecentUsers,
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/admin/users/recent'), {
        headers: { 'X-Admin-Password': adminPassword },
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to load recent users');
      }
      return await res.json() as UserWithoutPassword[];
    },
  });

  // Search user query
  const { data: user, isLoading: isLoadingUser, refetch: refetchUser, error: searchError } = useQuery({
    queryKey: ['/api/admin/users/search', searchPhone],
    enabled: false, // Manual trigger
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/admin/users/search?phone=${encodeURIComponent(searchPhone)}`), {
        headers: { 'X-Admin-Password': adminPassword },
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'User not found');
      }
      return await res.json() as UserWithoutPassword;
    },
  });

  // Track when we need to auto-refetch after selecting from recent users
  const [shouldAutoRefetch, setShouldAutoRefetch] = useState(false);

  // Update selectedUserId when user is found
  useEffect(() => {
    if (user) {
      setSelectedUserId(user.id);
    }
  }, [user]);

  // Auto-refetch when searchPhone changes and shouldAutoRefetch is true
  useEffect(() => {
    if (shouldAutoRefetch && searchPhone.trim()) {
      refetchUser();
      setShouldAutoRefetch(false);
    }
  }, [searchPhone, shouldAutoRefetch, refetchUser]);

  // Handle search errors
  useEffect(() => {
    if (searchError) {
      setSelectedUserId(null);
      toast({
        title: "Ошибка",
        description: searchError.message || "Пользователь не найден",
        variant: "destructive",
      });
    }
  }, [searchError, toast]);

  // Get user orders query
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/admin/users', selectedUserId, 'orders'],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/admin/users/${selectedUserId}/orders`), {
        headers: { 'X-Admin-Password': adminPassword },
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to get orders');
      }
      return await res.json() as DbOrder[];
    },
  });
  
  const orders = ordersData || [];

  // Update XP mutation
  const updateXPMutation = useMutation({
    mutationFn: async ({ userId, xp }: { userId: string; xp: number }) => {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/xp`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        credentials: 'include',
        body: JSON.stringify({ xp }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update XP');
      }
      return await res.json() as UserWithoutPassword;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/search'] });
      refetchUser();
      toast({
        title: "Успешно",
        description: "Уровень пользователя обновлен",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить уровень",
        variant: "destructive",
      });
    },
  });

  // Update custom discount mutation
  const updateDiscountMutation = useMutation({
    mutationFn: async ({ userId, discount }: { userId: string; discount: number | null }) => {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/custom-discount`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        credentials: 'include',
        body: JSON.stringify({ discount }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Не удалось установить скидку');
      }
      return await res.json() as UserWithoutPassword;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/search'] });
      refetchUser();
      setDiscountAmount("");
      toast({
        title: "Успешно",
        description: "Индивидуальная скидка установлена",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось установить скидку",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchPhone.trim()) {
      refetchUser();
    }
  };

  const handleXPChange = (operation: 'add' | 'subtract') => {
    if (!user) return;

    const amount = parseInt(xpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректное число XP",
        variant: "destructive",
      });
      return;
    }

    let newXP = user.xp;
    if (operation === 'add') {
      newXP = user.xp + amount;
    } else {
      newXP = Math.max(0, user.xp - amount);
    }

    updateXPMutation.mutate({ userId: user.id, xp: newXP });
  };

  const handleSetDiscount = () => {
    if (!user) return;

    const discount = discountAmount.trim() === "" ? null : parseInt(discountAmount);
    
    if (discount !== null && (isNaN(discount) || discount < 0 || discount > 100)) {
      toast({
        title: "Ошибка",
        description: "Скидка должна быть от 0 до 100%",
        variant: "destructive",
      });
      return;
    }

    updateDiscountMutation.mutate({ userId: user.id, discount });
  };

  const loyaltyProgress = user ? getLoyaltyProgress(user.xp) : null;

  const handleSelectUser = (selectedUser: UserWithoutPassword) => {
    // Update search phone and trigger auto-refetch
    setSearchPhone(selectedUser.phone || "");
    setSelectedUserId(selectedUser.id);
    setShowRecentUsers(false);
    setShouldAutoRefetch(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Поиск пользователя</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLeaderboardLink}
            data-testid="button-copy-leaderboard"
          >
            {isCopied ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Trophy className="h-4 w-4 mr-2" />
            )}
            {isCopied ? "Скопировано!" : "Лидерборд"}
            {!isCopied && <Copy className="h-3 w-3 ml-1.5" />}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Введите номер телефона"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              data-testid="input-search-phone"
            />
            <Button 
              onClick={handleSearch} 
              disabled={!searchPhone.trim() || isLoadingUser}
              data-testid="button-search-user"
            >
              <Search className="h-4 w-4 mr-2" />
              Найти
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setShowRecentUsers(!showRecentUsers)}
            data-testid="button-toggle-recent-users"
          >
            {showRecentUsers ? 'Скрыть последних пользователей' : 'Показать последних 10 пользователей'}
          </Button>
          
          {showRecentUsers && (
            <div className="mt-4">
              {isLoadingRecent ? (
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              ) : recentUsers && recentUsers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Последние зарегистрированные пользователи:</p>
                  <div className="space-y-1">
                    {recentUsers.map((u) => {
                      const progress = getLoyaltyProgress(u.xp);
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleSelectUser(u)}
                          className="w-full text-left p-3 rounded-md border hover-elevate active-elevate-2 transition-colors"
                          data-testid={`button-select-user-${u.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{u.name || u.phone || u.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-muted-foreground">{u.phone}</p>
                                {u.phoneVerified && (
                                  <Badge variant="outline" className="text-xs">✓</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge style={{ 
                                backgroundColor: progress.currentLevel.color,
                                color: '#fff',
                                fontSize: '0.75rem'
                              }}>
                                {progress.currentLevel.name}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{u.xp} XP</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Пользователи не найдены</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {user && loyaltyProgress && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Профиль пользователя</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Имя</p>
                  <p className="font-medium" data-testid="text-user-name">{user.name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium" data-testid="text-user-email">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Телефон</p>
                  <p className="font-medium" data-testid="text-user-phone">{user.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Текущий XP</p>
                  <p className="font-medium" data-testid="text-user-xp">{user.xp}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Индивидуальная скидка</p>
                  <p className="font-medium" data-testid="text-user-custom-discount">
                    {user.customDiscount !== null && user.customDiscount !== undefined ? `${user.customDiscount}%` : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge style={{ 
                      backgroundColor: loyaltyProgress.currentLevel.color,
                      color: '#fff'
                    }}>
                      Уровень {loyaltyProgress.currentLevel.level}
                    </Badge>
                    <span className="font-medium">{loyaltyProgress.currentLevel.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Скидка {loyaltyProgress.currentLevel.discount}%
                  </span>
                </div>

                {loyaltyProgress.nextLevel ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        До следующего уровня
                      </span>
                      <span className="font-medium">
                        {loyaltyProgress.xpToNextLevel} XP
                      </span>
                    </div>
                    <Progress value={loyaltyProgress.progressPercentage} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Максимальный уровень достигнут</p>
                )}

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={xpAmount}
                      onChange={(e) => setXpAmount(e.target.value)}
                      placeholder="Количество XP"
                      className="w-32"
                      data-testid="input-xp-amount"
                    />
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleXPChange('add')}
                      disabled={updateXPMutation.isPending}
                      data-testid="button-add-xp"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Добавить XP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleXPChange('subtract')}
                      disabled={user.xp === 0 || updateXPMutation.isPending}
                      data-testid="button-subtract-xp"
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Вычесть XP
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <p className="text-sm font-medium">Индивидуальная скидка на следующий заказ</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="0-100"
                      className="w-24"
                      data-testid="input-discount-amount"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSetDiscount}
                      disabled={updateDiscountMutation.isPending}
                      data-testid="button-set-discount"
                    >
                      Установить скидку
                    </Button>
                    {user.customDiscount !== null && user.customDiscount !== undefined && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDiscountAmount("");
                          updateDiscountMutation.mutate({ userId: user.id, discount: null });
                        }}
                        disabled={updateDiscountMutation.isPending}
                        data-testid="button-clear-discount"
                      >
                        Убрать скидку
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Скидка применяется после скидки на первый заказ и скидки лояльности. Автоматически обнуляется после использования.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>История заказов</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOrders ? (
                <p className="text-muted-foreground">Загрузка...</p>
              ) : orders.length === 0 ? (
                <p className="text-muted-foreground">Заказов пока нет</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const items = JSON.parse(order.items);
                    return (
                      <Card key={order.id} className="border">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-medium">Заказ #{order.id}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(order.createdAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-base">
                              {order.total.toFixed(2)} ₽
                            </Badge>
                          </div>

                          <div className="space-y-2 border-t pt-3">
                            <p className="text-sm font-medium">Состав заказа:</p>
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {item.name} × {item.quantity}г
                                </span>
                                <span>{(item.pricePerGram * item.quantity).toFixed(2)} ₽</span>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t text-sm">
                            <div>
                              <p className="text-muted-foreground">Адрес</p>
                              <p>{order.address}</p>
                            </div>
                            {order.comment && (
                              <div>
                                <p className="text-muted-foreground">Комментарий</p>
                                <p>{order.comment}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!user && searchPhone && !isLoadingUser && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Пользователь не найден
          </CardContent>
        </Card>
      )}
    </div>
  );
}
