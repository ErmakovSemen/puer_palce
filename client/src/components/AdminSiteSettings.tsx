import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { SiteSettings, UpdateSiteSettings } from "@shared/schema";
import { Save, Gift, Star, Award, Plus, X } from "lucide-react";

interface AdminSiteSettingsProps {
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export default function AdminSiteSettings({ adminFetch }: AdminSiteSettingsProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<UpdateSiteSettings>({
    contactEmail: "",
    contactPhone: "",
    contactTelegram: "",
    deliveryInfo: "",
    firstOrderDiscount: 20,
    loyaltyLevel2MinXP: 3000,
    loyaltyLevel2Discount: 5,
    loyaltyLevel3MinXP: 7000,
    loyaltyLevel3Discount: 10,
    loyaltyLevel4MinXP: 15000,
    loyaltyLevel4Discount: 15,
    xpMultiplier: 1,
    loyaltyLevel1Perks: ["Доступ к базовому каталогу"],
    loyaltyLevel2Perks: ["Доступ к базовому каталогу"],
    loyaltyLevel3Perks: ["Персональный чат с консультациями", "Приглашения на закрытые чайные вечеринки", "Возможность запросить любой чай"],
    loyaltyLevel4Perks: ["Все привилегии уровня 3", "Приоритетное обслуживание", "Эксклюзивные предложения"],
  });

  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
    queryFn: async () => {
      const data = await adminFetch("/api/site-settings");
      setFormData({
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        contactTelegram: data.contactTelegram,
        deliveryInfo: data.deliveryInfo,
        firstOrderDiscount: data.firstOrderDiscount ?? 20,
        loyaltyLevel2MinXP: data.loyaltyLevel2MinXP ?? 3000,
        loyaltyLevel2Discount: data.loyaltyLevel2Discount ?? 5,
        loyaltyLevel3MinXP: data.loyaltyLevel3MinXP ?? 7000,
        loyaltyLevel3Discount: data.loyaltyLevel3Discount ?? 10,
        loyaltyLevel4MinXP: data.loyaltyLevel4MinXP ?? 15000,
        loyaltyLevel4Discount: data.loyaltyLevel4Discount ?? 15,
        xpMultiplier: data.xpMultiplier ?? 1,
        loyaltyLevel1Perks: data.loyaltyLevel1Perks ?? ["Доступ к базовому каталогу"],
        loyaltyLevel2Perks: data.loyaltyLevel2Perks ?? ["Доступ к базовому каталогу"],
        loyaltyLevel3Perks: data.loyaltyLevel3Perks ?? ["Персональный чат с консультациями", "Приглашения на закрытые чайные вечеринки", "Возможность запросить любой чай"],
        loyaltyLevel4Perks: data.loyaltyLevel4Perks ?? ["Все привилегии уровня 3", "Приоритетное обслуживание", "Эксклюзивные предложения"],
      });
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateSiteSettings) => {
      return adminFetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({
        title: "Настройки сохранены",
        description: "Контактная информация успешно обновлена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedData = {
      ...formData,
      loyaltyLevel1Perks: (formData.loyaltyLevel1Perks || []).filter(p => p.trim() !== ""),
      loyaltyLevel2Perks: (formData.loyaltyLevel2Perks || []).filter(p => p.trim() !== ""),
      loyaltyLevel3Perks: (formData.loyaltyLevel3Perks || []).filter(p => p.trim() !== ""),
      loyaltyLevel4Perks: (formData.loyaltyLevel4Perks || []).filter(p => p.trim() !== ""),
    };
    updateMutation.mutate(cleanedData);
  };

  const handleChange = (field: keyof UpdateSiteSettings, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePerksChange = (field: "loyaltyLevel1Perks" | "loyaltyLevel2Perks" | "loyaltyLevel3Perks" | "loyaltyLevel4Perks", index: number, value: string) => {
    setFormData((prev) => {
      const perks = [...(prev[field] || [])];
      perks[index] = value;
      return { ...prev, [field]: perks };
    });
  };

  const addPerk = (field: "loyaltyLevel1Perks" | "loyaltyLevel2Perks" | "loyaltyLevel3Perks" | "loyaltyLevel4Perks") => {
    setFormData((prev) => {
      const perks = [...(prev[field] || []), ""];
      return { ...prev, [field]: perks };
    });
  };

  const removePerk = (field: "loyaltyLevel1Perks" | "loyaltyLevel2Perks" | "loyaltyLevel3Perks" | "loyaltyLevel4Perks", index: number) => {
    setFormData((prev) => {
      const perks = [...(prev[field] || [])];
      perks.splice(index, 1);
      return { ...prev, [field]: perks };
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Загрузка...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!settings) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Ошибка загрузки настроек</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Контактная информация</CardTitle>
        <CardDescription>
          Эти данные будут отображаться на странице оформления заказа
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email для связи</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail || ""}
              onChange={(e) => handleChange("contactEmail", e.target.value)}
              placeholder="support@example.com"
              data-testid="input-contact-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Телефон для связи</Label>
            <Input
              id="contactPhone"
              type="tel"
              value={formData.contactPhone || ""}
              onChange={(e) => handleChange("contactPhone", e.target.value)}
              placeholder="+79001234567"
              data-testid="input-contact-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactTelegram">Telegram</Label>
            <Input
              id="contactTelegram"
              type="text"
              value={formData.contactTelegram || ""}
              onChange={(e) => handleChange("contactTelegram", e.target.value)}
              placeholder="@username"
              data-testid="input-contact-telegram"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryInfo">Информация о доставке</Label>
            <Textarea
              id="deliveryInfo"
              value={formData.deliveryInfo || ""}
              onChange={(e) => handleChange("deliveryInfo", e.target.value)}
              placeholder="Доставка осуществляется через CDEK, Яндекс или WB..."
              rows={4}
              data-testid="textarea-delivery-info"
            />
          </div>

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </form>
      </CardContent>

      <CardHeader className="border-t">
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Скидка на первый заказ
        </CardTitle>
        <CardDescription>
          Скидка автоматически применяется для новых пользователей при первом заказе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstOrderDiscount">Размер скидки (%)</Label>
            <Input
              id="firstOrderDiscount"
              type="number"
              min={0}
              max={100}
              value={formData.firstOrderDiscount || 20}
              onChange={(e) => handleChange("firstOrderDiscount", parseInt(e.target.value) || 0)}
              data-testid="input-first-order-discount"
            />
            <p className="text-sm text-muted-foreground">
              Текущее значение: {formData.firstOrderDiscount || 20}%
            </p>
          </div>

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-first-order"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </form>
      </CardContent>

      <CardHeader className="border-t">
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Программа лояльности
        </CardTitle>
        <CardDescription>
          Настройте уровни, пороги XP и скидки для постоянных клиентов
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="xpMultiplier">Множитель XP (XP за 1 рубль)</Label>
            <Input
              id="xpMultiplier"
              type="number"
              min={1}
              max={10}
              value={formData.xpMultiplier || 1}
              onChange={(e) => handleChange("xpMultiplier", parseInt(e.target.value) || 1)}
              data-testid="input-xp-multiplier"
            />
            <p className="text-sm text-muted-foreground">
              За каждый рубль покупки клиент получает {formData.xpMultiplier || 1} XP
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-gray-400" />
              Уровень 1: Новичок (0 XP)
            </h4>
            <div className="space-y-2">
              <Label>Дополнительные бонусы</Label>
              {(formData.loyaltyLevel1Perks || []).map((perk, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={perk}
                    onChange={(e) => handlePerksChange("loyaltyLevel1Perks", index, e.target.value)}
                    placeholder="Описание бонуса"
                    data-testid={`input-level1-perk-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePerk("loyaltyLevel1Perks", index)}
                    data-testid={`button-remove-level1-perk-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPerk("loyaltyLevel1Perks")}
                data-testid="button-add-level1-perk"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить бонус
              </Button>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-green-600" />
              Уровень 2: Ценитель
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loyaltyLevel2MinXP">Минимум XP</Label>
                <Input
                  id="loyaltyLevel2MinXP"
                  type="number"
                  min={0}
                  value={formData.loyaltyLevel2MinXP || 3000}
                  onChange={(e) => handleChange("loyaltyLevel2MinXP", parseInt(e.target.value) || 0)}
                  data-testid="input-level2-min-xp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loyaltyLevel2Discount">Скидка (%)</Label>
                <Input
                  id="loyaltyLevel2Discount"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.loyaltyLevel2Discount || 5}
                  onChange={(e) => handleChange("loyaltyLevel2Discount", parseInt(e.target.value) || 0)}
                  data-testid="input-level2-discount"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Дополнительные бонусы</Label>
              {(formData.loyaltyLevel2Perks || []).map((perk, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={perk}
                    onChange={(e) => handlePerksChange("loyaltyLevel2Perks", index, e.target.value)}
                    placeholder="Описание бонуса"
                    data-testid={`input-level2-perk-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePerk("loyaltyLevel2Perks", index)}
                    data-testid={`button-remove-level2-perk-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPerk("loyaltyLevel2Perks")}
                data-testid="button-add-level2-perk"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить бонус
              </Button>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-purple-600" />
              Уровень 3: Чайный мастер
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loyaltyLevel3MinXP">Минимум XP</Label>
                <Input
                  id="loyaltyLevel3MinXP"
                  type="number"
                  min={0}
                  value={formData.loyaltyLevel3MinXP || 7000}
                  onChange={(e) => handleChange("loyaltyLevel3MinXP", parseInt(e.target.value) || 0)}
                  data-testid="input-level3-min-xp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loyaltyLevel3Discount">Скидка (%)</Label>
                <Input
                  id="loyaltyLevel3Discount"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.loyaltyLevel3Discount || 10}
                  onChange={(e) => handleChange("loyaltyLevel3Discount", parseInt(e.target.value) || 0)}
                  data-testid="input-level3-discount"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Дополнительные бонусы</Label>
              {(formData.loyaltyLevel3Perks || []).map((perk, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={perk}
                    onChange={(e) => handlePerksChange("loyaltyLevel3Perks", index, e.target.value)}
                    placeholder="Описание бонуса"
                    data-testid={`input-level3-perk-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePerk("loyaltyLevel3Perks", index)}
                    data-testid={`button-remove-level3-perk-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPerk("loyaltyLevel3Perks")}
                data-testid="button-add-level3-perk"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить бонус
              </Button>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-red-600" />
              Уровень 4: Чайный Гуру
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loyaltyLevel4MinXP">Минимум XP</Label>
                <Input
                  id="loyaltyLevel4MinXP"
                  type="number"
                  min={0}
                  value={formData.loyaltyLevel4MinXP || 15000}
                  onChange={(e) => handleChange("loyaltyLevel4MinXP", parseInt(e.target.value) || 0)}
                  data-testid="input-level4-min-xp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loyaltyLevel4Discount">Скидка (%)</Label>
                <Input
                  id="loyaltyLevel4Discount"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.loyaltyLevel4Discount || 15}
                  onChange={(e) => handleChange("loyaltyLevel4Discount", parseInt(e.target.value) || 0)}
                  data-testid="input-level4-discount"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Дополнительные бонусы</Label>
              {(formData.loyaltyLevel4Perks || []).map((perk, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={perk}
                    onChange={(e) => handlePerksChange("loyaltyLevel4Perks", index, e.target.value)}
                    placeholder="Описание бонуса"
                    data-testid={`input-level4-perk-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePerk("loyaltyLevel4Perks", index)}
                    data-testid={`button-remove-level4-perk-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPerk("loyaltyLevel4Perks")}
                data-testid="button-add-level4-perk"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить бонус
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-loyalty"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
