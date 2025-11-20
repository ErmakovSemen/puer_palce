import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    // Optional: Check payment status when component mounts
    if (orderId) {
      fetch(`/api/payments/check/${orderId}`)
        .then(res => res.json())
        .then(data => {
          console.log("Payment status:", data);
        })
        .catch(err => {
          console.error("Failed to check payment status:", err);
        });
    }
  }, [orderId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-serif">Оплата прошла успешно!</CardTitle>
          <CardDescription>
            Спасибо за ваш заказ. Электронный чек отправлен на указанный email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderId && (
            <div className="text-center text-sm text-muted-foreground">
              Номер заказа: <span className="font-medium">#{orderId}</span>
            </div>
          )}
          <div className="text-center text-sm text-muted-foreground">
            Мы свяжемся с вами для подтверждения деталей доставки
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setLocation("/")}
              className="w-full bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
              data-testid="button-back-home"
            >
              Вернуться на главную
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/profile")}
              className="w-full"
              data-testid="button-view-orders"
            >
              Посмотреть мои заказы
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
