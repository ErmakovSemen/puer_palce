import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrderSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-serif" data-testid="text-order-success-title">
            Оплата прошла успешно!
          </CardTitle>
          <CardDescription data-testid="text-order-success-description">
            Спасибо за ваш заказ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Чек будет отправлен вам в Telegram.
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Мы свяжемся с вами для подтверждения деталей доставки.
          </div>
          <div className="text-center text-xs text-muted-foreground pt-4">
            Вы можете закрыть это окно
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
