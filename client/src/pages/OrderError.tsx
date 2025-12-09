import { XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrderError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900 p-3">
              <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-serif" data-testid="text-order-error-title">
            Ошибка оплаты
          </CardTitle>
          <CardDescription data-testid="text-order-error-description">
            К сожалению, платёж не прошёл
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Попробуйте ещё раз или выберите другой способ оплаты.
          </div>
          <div className="text-center text-xs text-muted-foreground pt-4">
            Вы можете закрыть это окно и повторить оформление заказа в боте
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
