import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import AdminProductForm from "@/components/AdminProductForm";
import QuizConfigEditor from "@/components/QuizConfigEditor";
import TeaTypeManager from "@/components/TeaTypeManager";
import AdminUserManagement from "@/components/AdminUserManagement";
import AdminOrderManagement from "@/components/AdminOrderManagement";
import AdminSiteSettings from "@/components/AdminSiteSettings";
import AdminStats from "@/components/AdminStats";
import AdminBannerManagement from "@/components/AdminBannerManagement";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeaTypes } from "@/hooks/use-tea-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, LogOut, Palette, Download, Link as LinkIcon, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeaTypeBadgeStyleDynamic } from "@/lib/tea-colors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuizConfig, Product, InsertProduct, Settings, UpdateSettings } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Admin() {
  const [adminPassword, setAdminPassword] = useState<string | null>(
    sessionStorage.getItem("adminPassword")
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isYMLLinkDialogOpen, setIsYMLLinkDialogOpen] = useState(false);
  const [ymlLinkCopied, setYmlLinkCopied] = useState(false);
  const { toast } = useToast();
  const { data: teaTypesData } = useTeaTypes();

  // Check password by verifying with backend
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "X-Admin-Password": passwordInput,
        },
      });
      
      if (response.status === 401) {
        toast({
          title: "Ошибка",
          description: "Неверный пароль",
          variant: "destructive",
        });
        return;
      }
      
      if (!response.ok) {
        throw new Error("Server error");
      }
      
      // Password is correct
      sessionStorage.setItem("adminPassword", passwordInput);
      setAdminPassword(passwordInput);
      setPasswordInput("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось проверить пароль",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminPassword");
    setAdminPassword(null);
  };

  // Create custom fetch with admin password header
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (adminPassword) {
      headers.set("X-Admin-Password", adminPassword);
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Invalid password
      handleLogout();
      throw new Error("Неверный пароль");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  };

  // Products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: () => adminFetch("/api/products"),
    enabled: !!adminPassword,
  });

  // Quiz config
  const { data: quizConfig } = useQuery<QuizConfig>({
    queryKey: ["/api/quiz/config"],
    queryFn: () => adminFetch("/api/quiz/config"),
    enabled: !!adminPassword,
  });

  // Settings
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    queryFn: () => adminFetch("/api/settings"),
    enabled: !!adminPassword,
  });

  const createProductMutation = useMutation({
    mutationFn: async (product: InsertProduct) => {
      return await adminFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Товар добавлен",
        description: "Новый товар добавлен в каталог",
      });
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, product }: { id: number; product: InsertProduct }) => {
      return await adminFetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Товар обновлен",
        description: "Изменения сохранены",
      });
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return await adminFetch(`/api/products/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Товар удален",
        description: "Товар успешно удален из каталога",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateQuizMutation = useMutation({
    mutationFn: async (config: QuizConfig) => {
      return await adminFetch("/api/quiz/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz/config"] });
      toast({
        title: "Конфигурация сохранена",
        description: "Настройки квиза успешно обновлены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateDesignModeMutation = useMutation({
    mutationFn: async (designMode: "classic" | "minimalist") => {
      return await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designMode }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Дизайн обновлён",
        description: "Настройки дизайна успешно применены",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот товар?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleFormSubmit = (data: any) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, product: data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const handleDownloadYML = () => {
    window.open('/api/products/export/yml', '_blank');
  };

  const handleShowYMLLink = () => {
    setIsYMLLinkDialogOpen(true);
    setYmlLinkCopied(false);
  };

  const handleCopyYMLLink = () => {
    const feedUrl = `${window.location.origin}/api/yml-feed`;
    navigator.clipboard.writeText(feedUrl);
    setYmlLinkCopied(true);
    toast({
      title: "Ссылка скопирована",
      description: "Ссылка на YML-фид скопирована в буфер обмена",
    });
    setTimeout(() => setYmlLinkCopied(false), 2000);
  };

  // Login screen
  if (!adminPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-3xl font-bold mb-6 text-center">
            Вход в админ-панель
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Введите пароль"
                required
                data-testid="input-admin-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              data-testid="button-admin-login"
            >
              Войти
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartItemCount={0}
        onCartClick={() => {}}
        isAdmin={true}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold" data-testid="text-admin-title">
            Панель управления
          </h1>
          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const newMode = settings?.designMode === "minimalist" ? "classic" : "minimalist";
                updateDesignModeMutation.mutate(newMode);
              }}
              data-testid="button-toggle-design"
              aria-label={settings?.designMode === "minimalist" ? "Переключить на классический дизайн" : "Переключить на минималистичный дизайн"}
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">
                {settings?.designMode === "minimalist" ? "Классический" : "Минималистичный"}
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              data-testid="button-admin-logout"
              aria-label="Выйти из админ-панели"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Выйти</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full max-w-5xl mb-8 flex overflow-x-auto md:grid md:grid-cols-8">
            <TabsTrigger value="products" data-testid="tab-products" className="min-w-max">Товары</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders" className="min-w-max">Заказы</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users" className="min-w-max">Пользователи</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats" className="min-w-max">Статистика</TabsTrigger>
            <TabsTrigger value="banners" data-testid="tab-banners" className="min-w-max">Баннеры</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings" className="min-w-max">Настройки</TabsTrigger>
            <TabsTrigger value="tea-types" data-testid="tab-tea-types" className="min-w-max">Типы чая</TabsTrigger>
            <TabsTrigger value="quiz" data-testid="tab-quiz" className="min-w-max">Квиз подбора</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
              <h2 className="font-serif text-xl sm:text-2xl font-semibold">Управление товарами</h2>
              <div className="flex gap-2 sm:gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      data-testid="button-export-yml"
                      aria-label="Экспортировать в YML"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline ml-2">Экспортировать в YML</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadYML} data-testid="menu-item-download-yml">
                      <Download className="w-4 h-4 mr-2" />
                      Скачать файл YML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShowYMLLink} data-testid="menu-item-show-yml-link">
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Получить ссылку на фид
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={handleAddProduct}
                  className="bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
                  data-testid="button-add-product"
                  aria-label="Добавить товар"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Добавить товар</span>
                </Button>
              </div>
            </div>

            {productsLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Загрузка товаров...</p>
              </Card>
            ) : products.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground" data-testid="text-no-products">
                  Нет товаров. Добавьте первый товар.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <Card key={product.id} className="p-6" data-testid={`admin-product-${product.id}`}>
                    <div className="flex gap-6">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-32 h-32 object-cover rounded-md"
                        data-testid={`img-admin-product-${product.id}`}
                      />
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-serif text-2xl font-semibold mb-2" data-testid={`text-admin-product-name-${product.id}`}>
                            {product.name}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge 
                              style={getTeaTypeBadgeStyleDynamic(product.teaType, teaTypesData)}
                              data-testid={`badge-admin-tea-type-${product.id}`}
                            >
                              {product.teaType}
                            </Badge>
                            {product.effects.map((effect) => (
                              <Badge 
                                key={effect} 
                                variant="outline"
                                data-testid={`badge-admin-effect-${product.id}-${effect}`}
                              >
                                {effect}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <p className="text-muted-foreground" data-testid={`text-admin-product-description-${product.id}`}>
                          {product.description}
                        </p>
                        <p className="text-xl font-semibold text-primary" data-testid={`text-admin-product-price-${product.id}`}>
                          {product.pricePerGram} ₽/г
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditProduct(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteProduct(product.id)}
                          data-testid={`button-delete-product-${product.id}`}
                          disabled={deleteProductMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            <div className="mb-6">
              <h2 className="font-serif text-2xl font-semibold">Управление заказами</h2>
              <p className="text-muted-foreground mt-2">
                Просмотр и обработка всех заказов с возможностью изменения статусов
              </p>
            </div>
            {adminPassword && <AdminOrderManagement adminPassword={adminPassword} />}
          </TabsContent>

          <TabsContent value="users">
            <div className="mb-6">
              <h2 className="font-serif text-2xl font-semibold">Управление пользователями</h2>
              <p className="text-muted-foreground mt-2">
                Поиск пользователей и управление их уровнем лояльности
              </p>
            </div>
            {adminPassword && <AdminUserManagement adminPassword={adminPassword} />}
          </TabsContent>

          <TabsContent value="stats">
            <AdminStats adminFetch={adminFetch} />
          </TabsContent>

          <TabsContent value="banners">
            <AdminBannerManagement adminFetch={adminFetch} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="mb-6">
              <h2 className="font-serif text-2xl font-semibold">Настройки сайта</h2>
              <p className="text-muted-foreground mt-2">
                Редактируйте контактную информацию и данные о доставке
              </p>
            </div>
            <AdminSiteSettings adminFetch={adminFetch} />
          </TabsContent>

          <TabsContent value="tea-types">
            <div className="mb-6">
              <h2 className="font-serif text-2xl font-semibold">Управление типами чая</h2>
              <p className="text-muted-foreground mt-2">
                Создавайте и редактируйте типы чая с индивидуальными цветами для каждой категории
              </p>
            </div>
            {adminPassword && <TeaTypeManager adminPassword={adminPassword} />}
          </TabsContent>

          <TabsContent value="quiz">
            {quizConfig ? (
              <QuizConfigEditor
                config={quizConfig}
                onSave={(config) => updateQuizMutation.mutate(config)}
              />
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Загрузка конфигурации квиза...</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingProduct ? "Редактировать товар" : "Добавить товар"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Внесите изменения в информацию о товаре"
                : "Заполните информацию о новом товаре"}
            </DialogDescription>
          </DialogHeader>
          <AdminProductForm
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingProduct(null);
            }}
            defaultValues={editingProduct ? {
              name: editingProduct.name,
              category: editingProduct.category as "tea" | "teaware",
              pricePerGram: editingProduct.pricePerGram,
              description: editingProduct.description,
              images: editingProduct.images,
              teaType: editingProduct.teaType,
              effects: editingProduct.effects,
              availableQuantities: editingProduct.availableQuantities,
              fixedQuantityOnly: editingProduct.fixedQuantityOnly,
              fixedQuantity: editingProduct.fixedQuantity,
            } : undefined}
            isSubmitting={createProductMutation.isPending || updateProductMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isYMLLinkDialogOpen} onOpenChange={setIsYMLLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Ссылка на YML-фид</DialogTitle>
            <DialogDescription>
              Используйте эту ссылку для автоматической загрузки товаров маркетплейсами
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <code className="text-sm break-all" data-testid="text-yml-feed-url">
                {window.location.origin}/api/yml-feed
              </code>
            </div>
            <Button
              onClick={handleCopyYMLLink}
              className="w-full"
              data-testid="button-copy-yml-link"
            >
              {ymlLinkCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Скопировать ссылку
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Эта ссылка автоматически обновляется при изменении товаров. 
              Маркетплейсы могут использовать её для регулярной синхронизации каталога.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
