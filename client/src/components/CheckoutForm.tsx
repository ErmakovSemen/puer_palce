import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getLoyaltyDiscount } from "@shared/loyalty";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AlertCircle, Mail, Phone, MessageCircle, Truck, UserCircle } from "lucide-react";
import type { SiteSettings } from "@shared/schema";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const checkoutSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Введите корректный email"),
  receiptEmail: z.string().email("Введите корректный email для чека").optional().or(z.literal("")),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  address: z.string().min(10, "Введите полный адрес доставки"),
  comment: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

interface CheckoutFormProps {
  onSubmit: (data: CheckoutFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  total: number;
  user?: {
    email: string | null;
    name?: string | null;
    phone?: string | null;
    phoneVerified: boolean;
    xp: number;
    firstOrderDiscountUsed: boolean;
    customDiscount?: number | null;
  } | null;
}

export default function CheckoutForm({ onSubmit, onCancel, isSubmitting, total, user }: CheckoutFormProps) {
  const { toast } = useToast();
  
  // First order discount (20% if user hasn't used it yet)
  const firstOrderDiscount = (user && !user.firstOrderDiscountUsed) ? 20 : 0;
  const firstOrderDiscountAmount = (total * firstOrderDiscount) / 100;
  
  // Loyalty discount (only if user is verified)
  const loyaltyDiscount = (user && user.phoneVerified) ? getLoyaltyDiscount(user.xp) : 0;
  const loyaltyDiscountAmount = ((total - firstOrderDiscountAmount) * loyaltyDiscount) / 100;
  
  // Custom discount (individual discount from admin)
  const customDiscount = user?.customDiscount || 0;
  const customDiscountAmount = ((total - firstOrderDiscountAmount - loyaltyDiscountAmount) * customDiscount) / 100;
  
  // Calculate final total (clamp to zero to prevent negative totals)
  const finalTotal = Math.max(total - firstOrderDiscountAmount - loyaltyDiscountAmount - customDiscountAmount, 0);
  
  // Fetch site settings for contact info
  const { data: siteSettings } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
  });
  
  // Copy to clipboard function
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Скопировано",
        description: `${label} скопирован в буфер обмена`,
      });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать",
        variant: "destructive",
      });
    }
  };
  
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      receiptEmail: user?.email || "",
      phone: user?.phone || "",
      address: "",
      comment: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Show warning if user is not verified */}
        {user && !user.phoneVerified && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Подтвердите телефон в профиле, чтобы получать скидки программы лояльности
            </AlertDescription>
          </Alert>
        )}
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input placeholder="Иван Иванов" {...field} data-testid="input-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="ivan@example.com" {...field} data-testid="input-email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="receiptEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email для чека (необязательно)</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="Оставьте пустым для использования основного email" 
                  {...field} 
                  data-testid="input-receipt-email" 
                />
              </FormControl>
              <p className="text-sm text-muted-foreground mt-1">
                На этот адрес будет отправлен электронный чек. Если не указать, будет использован основной email
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Телефон</FormLabel>
              <FormControl>
                <Input placeholder="+7 (999) 123-45-67" {...field} data-testid="input-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Адрес доставки</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Москва, ул. Пушкина, д. 10, кв. 5"
                  {...field}
                  data-testid="input-address"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий (необязательно)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Дополнительная информация к заказу"
                  {...field}
                  data-testid="input-comment"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Information Card */}
        {siteSettings && (
          <Card className="p-4 bg-muted/30">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <UserCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  {user ? (
                    <span>
                      История заказов доступна в{" "}
                      <Link href="/profile" className="text-primary hover:underline" data-testid="link-profile">
                        личном кабинете
                      </Link>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Зарегистрируйтесь, чтобы получить доступ к истории заказов в личном кабинете
                    </span>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Связаться с нами:</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={`mailto:${siteSettings.contactEmail}`}
                      className="text-primary hover:underline"
                      data-testid="link-contact-email"
                      onClick={(e) => {
                        e.preventDefault();
                        copyToClipboard(siteSettings.contactEmail, "Email");
                      }}
                    >
                      {siteSettings.contactEmail}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={`tel:${siteSettings.contactPhone}`}
                      className="text-primary hover:underline"
                      data-testid="link-contact-phone"
                      onClick={(e) => {
                        e.preventDefault();
                        copyToClipboard(siteSettings.contactPhone, "Телефон");
                      }}
                    >
                      {siteSettings.contactPhone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Telegram:</span>
                    <a 
                      href={`https://t.me/${siteSettings.contactTelegram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid="link-contact-telegram"
                      onClick={(e) => {
                        e.preventDefault();
                        copyToClipboard(siteSettings.contactTelegram, "Telegram");
                      }}
                    >
                      {siteSettings.contactTelegram}
                    </a>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-muted-foreground" data-testid="text-delivery-info">
                  {siteSettings.deliveryInfo}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Order Summary */}
        <div className="space-y-2 pt-4">
          <Separator />
          <div className="space-y-2 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Сумма заказа:</span>
              <span data-testid="text-order-subtotal">{Math.round(total)} ₽</span>
            </div>
            {firstOrderDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 font-medium">Скидка на первый заказ (-20%):</span>
                <span className="text-amber-600 font-medium" data-testid="text-first-order-discount">
                  -{Math.round(firstOrderDiscountAmount)} ₽
                </span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Скидка программы лояльности ({loyaltyDiscount}%):</span>
                <span className="text-green-600" data-testid="text-loyalty-discount">
                  -{Math.round(loyaltyDiscountAmount)} ₽
                </span>
              </div>
            )}
            {customDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-purple-600 font-medium">Индивидуальная скидка ({customDiscount}%):</span>
                <span className="text-purple-600 font-medium" data-testid="text-custom-discount">
                  -{Math.round(customDiscountAmount)} ₽
                </span>
              </div>
            )}
            {(firstOrderDiscount > 0 || loyaltyDiscount > 0 || customDiscount > 0) && (
              <>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Итого к оплате:</span>
                  <span data-testid="text-final-total">{Math.round(finalTotal)} ₽</span>
                </div>
              </>
            )}
            {firstOrderDiscount === 0 && loyaltyDiscount === 0 && customDiscount === 0 && (
              <div className="flex justify-between font-semibold">
                <span>Итого:</span>
                <span data-testid="text-total">{Math.round(total)} ₽</span>
              </div>
            )}
          </div>
          <Separator />
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isSubmitting}
            data-testid="button-cancel-checkout"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
            disabled={isSubmitting}
            data-testid="button-submit-order"
          >
            {isSubmitting ? "Отправка..." : "Оформить заказ"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
