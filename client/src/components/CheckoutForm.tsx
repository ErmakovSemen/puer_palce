import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const checkoutSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Введите корректный email"),
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
    email: string;
    name?: string | null;
    phone?: string | null;
    xp: number;
  } | null;
}

export default function CheckoutForm({ onSubmit, onCancel, isSubmitting, total, user }: CheckoutFormProps) {
  const discount = user ? getLoyaltyDiscount(user.xp) : 0;
  const discountAmount = (total * discount) / 100;
  const finalTotal = total - discountAmount;
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: "",
      comment: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        {/* Order Summary */}
        <div className="space-y-2 pt-4">
          <Separator />
          <div className="space-y-2 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Сумма заказа:</span>
              <span data-testid="text-order-subtotal">{Math.round(total)} ₽</span>
            </div>
            {discount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Скидка ({discount}%):</span>
                  <span className="text-green-600" data-testid="text-discount-amount">
                    -{Math.round(discountAmount)} ₽
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Итого к оплате:</span>
                  <span data-testid="text-final-total">{Math.round(finalTotal)} ₽</span>
                </div>
              </>
            )}
            {discount === 0 && (
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
