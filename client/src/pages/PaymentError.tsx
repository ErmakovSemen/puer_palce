import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentError() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get("orderId");

  const handleTryAgain = () => {
    if (orderId) {
      // Try to reinitialize payment for the same order
      fetch("/api/payments/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.paymentUrl) {
            window.location.href = data.paymentUrl;
          } else {
            console.error("Failed to reinitialize payment");
          }
        })
        .catch(err => {
          console.error("Payment initialization error:", err);
        });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900 p-3">
              <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-serif">Ошибка оплаты</CardTitle>
          <CardDescription>
            К сожалению, не удалось обработать платёж. Попробуйте снова или свяжитесь с нами.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderId && (
            <div className="text-center text-sm text-muted-foreground">
              Номер заказа: <span className="font-medium">#{orderId}</span>
            </div>
          )}
          <div className="text-center text-sm text-muted-foreground">
            Ваш заказ сохранён. Вы можете попробовать оплатить его снова.
          </div>
          <div className="flex flex-col gap-2">
            {orderId && (
              <Button
                onClick={handleTryAgain}
                className="w-full bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
                data-testid="button-try-again"
              >
                Попробовать снова
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="w-full"
              data-testid="button-back-home"
            >
              Вернуться на главную
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
