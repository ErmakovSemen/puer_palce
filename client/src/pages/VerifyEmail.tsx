import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Home, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  // Read email from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, []);

  const verifyMutation = useMutation({
    mutationFn: async (data: { email: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-email", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка верификации");
      }
      return await res.json();
    },
    onSuccess: () => {
      setIsVerified(true);
      toast({
        title: "Email подтвержден!",
        description: "Теперь вы можете войти в аккаунт",
      });
      setTimeout(() => {
        setLocation("/auth");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка верификации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка отправки кода");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Код отправлен!",
        description: "Проверьте вашу почту",
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

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMutation.mutate({ email, code });
  };

  const handleResend = () => {
    if (!email) {
      toast({
        title: "Введите email",
        description: "Укажите ваш email для повторной отправки кода",
        variant: "destructive",
      });
      return;
    }
    resendMutation.mutate(email);
  };

  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <h2 className="text-2xl font-bold">Email подтвержден!</h2>
              <p className="text-muted-foreground">
                Перенаправление на страницу входа...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Form Section */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Home Button */}
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <Home className="h-4 w-4 mr-2" />
                На главную
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Подтверждение Email</CardTitle>
              <CardDescription>
                Мы отправили 6-значный код на вашу почту. Введите его ниже для подтверждения аккаунта.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-verify-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Код подтверждения</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    required
                    data-testid="input-verify-code"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={verifyMutation.isPending}
                  data-testid="button-verify"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    "Подтвердить"
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Не получили код?{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    className="p-0 h-auto underline"
                    onClick={handleResend}
                    disabled={resendMutation.isPending}
                    data-testid="button-resend"
                  >
                    {resendMutation.isPending ? "Отправка..." : "Отправить повторно"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hidden lg:flex bg-black text-white items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-serif font-bold">Один шаг до завершения</h1>
          <p className="text-lg text-gray-300">
            Подтвердите ваш email, чтобы защитить аккаунт и получить доступ ко всем функциям
          </p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Безопасность вашего аккаунта</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Уведомления о заказах</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Доступ к программе лояльности</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
