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
import { Save } from "lucide-react";

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
    updateMutation.mutate(formData);
  };

  const handleChange = (field: keyof UpdateSiteSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    </Card>
  );
}
