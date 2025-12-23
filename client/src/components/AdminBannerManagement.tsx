import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { InfoBanner, InsertInfoBanner, BannerButton, BannerWidthVariant, BannerHeightVariant } from "@shared/schema";
import { BANNER_SLOTS, BANNER_WIDTH_VARIANTS, BANNER_HEIGHT_VARIANTS } from "@shared/schema";
import { Plus, Pencil, Trash2, Eye, EyeOff, Monitor, Smartphone, GripVertical, X, LayoutDashboard } from "lucide-react";
import BannerLayoutPreview from "./BannerLayoutPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminBannerManagementProps {
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
}

const AVAILABLE_ICONS = [
  { value: "Truck", label: "Грузовик (доставка)" },
  { value: "Gift", label: "Подарок" },
  { value: "Coffee", label: "Чашка чая" },
  { value: "Leaf", label: "Лист" },
  { value: "Star", label: "Звезда" },
  { value: "Heart", label: "Сердце" },
  { value: "Percent", label: "Скидка" },
  { value: "Clock", label: "Часы" },
  { value: "Shield", label: "Защита" },
  { value: "Award", label: "Награда" },
];

type FormData = {
  title: string;
  description: string;
  icon: string;
  theme: "dark" | "light";
  buttons: BannerButton[];
  desktopSlot: string;
  mobileSlot: string;
  hideOnDesktop: boolean;
  hideOnMobile: boolean;
  isActive: boolean;
  betweenRowIndexDesktop: number | null;
  betweenRowIndexMobile: number | null;
  widthVariant: BannerWidthVariant;
  heightVariant: BannerHeightVariant;
};

const defaultFormData: FormData = {
  title: "",
  description: "",
  icon: "",
  theme: "dark",
  buttons: [],
  desktopSlot: "after_filters",
  mobileSlot: "after_filters",
  hideOnDesktop: false,
  hideOnMobile: false,
  isActive: true,
  betweenRowIndexDesktop: null,
  betweenRowIndexMobile: null,
  widthVariant: "full",
  heightVariant: "standard",
};

export default function AdminBannerManagement({ adminFetch }: AdminBannerManagementProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<InfoBanner | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<InfoBanner | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [deviceView, setDeviceView] = useState<"desktop" | "mobile">("desktop");
  const [viewMode, setViewMode] = useState<"list" | "visual">("visual");

  const { data: banners = [], isLoading } = useQuery<InfoBanner[]>({
    queryKey: ["/api/admin/banners"],
    queryFn: () => adminFetch("/api/admin/banners"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertInfoBanner) => {
      return adminFetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Баннер создан",
        description: "Информационный блок успешно добавлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать баннер",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertInfoBanner> }) => {
      return adminFetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setIsDialogOpen(false);
      setEditingBanner(null);
      resetForm();
      toast({
        title: "Баннер обновлён",
        description: "Информационный блок успешно изменён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить баннер",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return adminFetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setDeletingBanner(null);
      toast({
        title: "Баннер удалён",
        description: "Информационный блок успешно удалён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить баннер",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return adminFetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingBanner(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (banner: InfoBanner) => {
    setEditingBanner(banner);
    let buttons: BannerButton[] = [];
    try {
      buttons = banner.buttons ? JSON.parse(banner.buttons) : [];
    } catch {
      buttons = [];
    }
    setFormData({
      title: banner.title,
      description: banner.description,
      icon: banner.icon || "",
      theme: banner.theme as "dark" | "light",
      buttons,
      desktopSlot: banner.desktopSlot,
      mobileSlot: banner.mobileSlot,
      hideOnDesktop: banner.hideOnDesktop,
      hideOnMobile: banner.hideOnMobile,
      isActive: banner.isActive,
      betweenRowIndexDesktop: banner.betweenRowIndexDesktop ?? null,
      betweenRowIndexMobile: banner.betweenRowIndexMobile ?? null,
      widthVariant: (banner.widthVariant as BannerWidthVariant) || "full",
      heightVariant: (banner.heightVariant as BannerHeightVariant) || "standard",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingBanner) {
      const updateData: Partial<InsertInfoBanner> = {
        title: formData.title,
        description: formData.description,
        icon: formData.icon || null,
        theme: formData.theme,
        buttons: formData.buttons.length > 0 ? JSON.stringify(formData.buttons) : null,
        desktopSlot: formData.desktopSlot,
        mobileSlot: formData.mobileSlot,
        hideOnDesktop: formData.hideOnDesktop,
        hideOnMobile: formData.hideOnMobile,
        isActive: formData.isActive,
        betweenRowIndexDesktop: formData.betweenRowIndexDesktop,
        betweenRowIndexMobile: formData.betweenRowIndexMobile,
        widthVariant: formData.widthVariant,
        heightVariant: formData.heightVariant,
      };
      updateMutation.mutate({ id: editingBanner.id, data: updateData });
    } else {
      const createData: InsertInfoBanner = {
        title: formData.title,
        description: formData.description,
        icon: formData.icon || null,
        theme: formData.theme,
        buttons: formData.buttons.length > 0 ? JSON.stringify(formData.buttons) : null,
        desktopSlot: formData.desktopSlot,
        mobileSlot: formData.mobileSlot,
        desktopOrder: 999,
        mobileOrder: 999,
        hideOnDesktop: formData.hideOnDesktop,
        hideOnMobile: formData.hideOnMobile,
        isActive: formData.isActive,
        betweenRowIndexDesktop: formData.betweenRowIndexDesktop,
        betweenRowIndexMobile: formData.betweenRowIndexMobile,
        widthVariant: formData.widthVariant,
        heightVariant: formData.heightVariant,
      };
      createMutation.mutate(createData);
    }
  };

  const addButton = () => {
    setFormData(prev => ({
      ...prev,
      buttons: [...prev.buttons, { text: "", action: "" }],
    }));
  };

  const updateButton = (index: number, field: keyof BannerButton, value: string) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) => 
        i === index ? { ...btn, [field]: value } : btn
      ),
    }));
  };

  const removeButton = (index: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  };

  const getSlotName = (slotId: string) => {
    return BANNER_SLOTS.find(s => s.id === slotId)?.name || slotId;
  };

  const sortedBanners = [...banners].sort((a, b) => {
    if (deviceView === "desktop") {
      return a.desktopOrder - b.desktopOrder;
    }
    return a.mobileOrder - b.mobileOrder;
  });

  const groupedBanners = sortedBanners.reduce((acc, banner) => {
    const slot = deviceView === "desktop" ? banner.desktopSlot : banner.mobileSlot;
    if (!acc[slot]) acc[slot] = [];
    acc[slot].push(banner);
    return acc;
  }, {} as Record<string, InfoBanner[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Загрузка...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Информационные блоки</CardTitle>
              <CardDescription>
                Управляйте баннерами и информационными карточками на сайте
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-muted rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewMode === "visual" ? "default" : "ghost"}
                  onClick={() => setViewMode("visual")}
                  data-testid="button-view-visual"
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  Визуальный
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <GripVertical className="w-4 h-4 mr-1" />
                  Список
                </Button>
              </div>
              {viewMode === "list" && (
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={deviceView === "desktop" ? "default" : "ghost"}
                    onClick={() => setDeviceView("desktop")}
                    data-testid="button-device-desktop"
                  >
                    <Monitor className="w-4 h-4 mr-1" />
                    Десктоп
                  </Button>
                  <Button
                    size="sm"
                    variant={deviceView === "mobile" ? "default" : "ghost"}
                    onClick={() => setDeviceView("mobile")}
                    data-testid="button-device-mobile"
                  >
                    <Smartphone className="w-4 h-4 mr-1" />
                    Мобильный
                  </Button>
                </div>
              )}
              <Button onClick={openCreateDialog} data-testid="button-create-banner">
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {banners.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Нет информационных блоков</p>
              <Button onClick={openCreateDialog} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Создать первый баннер
              </Button>
            </div>
          ) : viewMode === "visual" ? (
            <BannerLayoutPreview
              banners={banners}
              adminFetch={adminFetch}
              onEditBanner={openEditDialog}
            />
          ) : (
            <div className="space-y-6">
              {BANNER_SLOTS.map(slot => {
                const slotBanners = groupedBanners[slot.id] || [];
                const hidden = deviceView === "desktop" 
                  ? slotBanners.filter(b => b.hideOnDesktop)
                  : slotBanners.filter(b => b.hideOnMobile);
                const visible = deviceView === "desktop"
                  ? slotBanners.filter(b => !b.hideOnDesktop)
                  : slotBanners.filter(b => !b.hideOnMobile);

                if (slotBanners.length === 0) return null;

                return (
                  <div key={slot.id} className="border rounded-lg p-4">
                    <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                      {slot.name}
                      {hidden.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {hidden.length} скрыт{hidden.length === 1 ? "" : "о"}
                        </Badge>
                      )}
                    </h3>
                    <div className="space-y-2">
                      {slotBanners.map(banner => {
                        const isHidden = deviceView === "desktop" ? banner.hideOnDesktop : banner.hideOnMobile;
                        return (
                          <div
                            key={banner.id}
                            className={`flex items-center gap-3 p-3 border rounded-lg ${
                              isHidden ? "opacity-50 bg-muted/50" : ""
                            } ${!banner.isActive ? "border-dashed" : ""}`}
                            data-testid={`banner-item-${banner.id}`}
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                            <div
                              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                                banner.theme === "dark"
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-black border"
                              }`}
                            >
                              {banner.icon ? banner.icon.slice(0, 2) : "—"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{banner.title}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {banner.description.slice(0, 50)}...
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!banner.isActive && (
                                <Badge variant="secondary">Неактивен</Badge>
                              )}
                              {isHidden && (
                                <Badge variant="outline">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Скрыт
                                </Badge>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleActiveMutation.mutate({ 
                                  id: banner.id, 
                                  isActive: !banner.isActive 
                                })}
                                data-testid={`button-toggle-active-${banner.id}`}
                              >
                                {banner.isActive ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDialog(banner)}
                                data-testid={`button-edit-${banner.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeletingBanner(banner)}
                                data-testid={`button-delete-${banner.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? "Редактировать баннер" : "Создать баннер"}
            </DialogTitle>
            <DialogDescription>
              Заполните информацию для информационного блока
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="title">Заголовок</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="БЕСПЛАТНАЯ ДОСТАВКА"
                  required
                  data-testid="input-banner-title"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Подробное описание для карточки..."
                  rows={3}
                  required
                  data-testid="input-banner-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Иконка</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger data-testid="select-banner-icon">
                    <SelectValue placeholder="Выберите иконку" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map(icon => (
                      <SelectItem key={icon.value} value={icon.value}>
                        {icon.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Тема</Label>
                <Select
                  value={formData.theme}
                  onValueChange={(value: "dark" | "light") => setFormData(prev => ({ ...prev, theme: value }))}
                >
                  <SelectTrigger data-testid="select-banner-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Тёмная</SelectItem>
                    <SelectItem value="light">Светлая</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Позиция на десктопе</Label>
                <Select
                  value={formData.desktopSlot}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, desktopSlot: value }))}
                >
                  <SelectTrigger data-testid="select-desktop-slot">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_SLOTS.map(slot => (
                      <SelectItem key={slot.id} value={slot.id}>{slot.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Позиция на мобильном</Label>
                <Select
                  value={formData.mobileSlot}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, mobileSlot: value }))}
                >
                  <SelectTrigger data-testid="select-mobile-slot">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_SLOTS.map(slot => (
                      <SelectItem key={slot.id} value={slot.id}>{slot.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(formData.desktopSlot === "between_products" || formData.mobileSlot === "between_products") && (
              <div className="grid grid-cols-2 gap-4">
                {formData.desktopSlot === "between_products" && (
                  <div className="space-y-2">
                    <Label>Ряд товаров (десктоп)</Label>
                    <Select
                      value={formData.betweenRowIndexDesktop?.toString() || "0"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, betweenRowIndexDesktop: parseInt(value) }))}
                    >
                      <SelectTrigger data-testid="select-desktop-row">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">После ряда 1</SelectItem>
                        <SelectItem value="1">После ряда 2</SelectItem>
                        <SelectItem value="2">После ряда 3</SelectItem>
                        <SelectItem value="3">После ряда 4</SelectItem>
                        <SelectItem value="4">После ряда 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.mobileSlot === "between_products" && (
                  <div className="space-y-2">
                    <Label>Ряд товаров (мобильный)</Label>
                    <Select
                      value={formData.betweenRowIndexMobile?.toString() || "0"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, betweenRowIndexMobile: parseInt(value) }))}
                    >
                      <SelectTrigger data-testid="select-mobile-row">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">После ряда 1</SelectItem>
                        <SelectItem value="1">После ряда 2</SelectItem>
                        <SelectItem value="2">После ряда 3</SelectItem>
                        <SelectItem value="3">После ряда 4</SelectItem>
                        <SelectItem value="4">После ряда 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ширина баннера</Label>
                <Select
                  value={formData.widthVariant}
                  onValueChange={(value: BannerWidthVariant) => setFormData(prev => ({ ...prev, widthVariant: value }))}
                >
                  <SelectTrigger data-testid="select-width-variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_WIDTH_VARIANTS.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Высота баннера</Label>
                <Select
                  value={formData.heightVariant}
                  onValueChange={(value: BannerHeightVariant) => setFormData(prev => ({ ...prev, heightVariant: value }))}
                >
                  <SelectTrigger data-testid="select-height-variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_HEIGHT_VARIANTS.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Кнопки (опционально)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addButton}>
                  <Plus className="w-3 h-3 mr-1" />
                  Добавить кнопку
                </Button>
              </div>
              {formData.buttons.map((btn, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={btn.text}
                    onChange={(e) => updateButton(index, "text", e.target.value)}
                    placeholder="Текст кнопки"
                    className="flex-1"
                  />
                  <Input
                    value={btn.action || ""}
                    onChange={(e) => updateButton(index, "action", e.target.value)}
                    placeholder="Ссылка (опционально)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeButton(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="hideOnDesktop" className="font-normal">
                    Скрыть на десктопе
                  </Label>
                </div>
                <Switch
                  id="hideOnDesktop"
                  checked={formData.hideOnDesktop}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hideOnDesktop: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="hideOnMobile" className="font-normal">
                    Скрыть на мобильном
                  </Label>
                </div>
                <Switch
                  id="hideOnMobile"
                  checked={formData.hideOnMobile}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hideOnMobile: checked }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label htmlFor="isActive" className="font-normal">
                Активен (показывать на сайте)
              </Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-banner"
              >
                {editingBanner ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingBanner} onOpenChange={() => setDeletingBanner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить баннер?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить баннер "{deletingBanner?.title}"?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBanner && deleteMutation.mutate(deletingBanner.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
