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

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReset, setIsReset] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Read email from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, []);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { email: string; code: string; newPassword: string; confirmPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка сброса пароля");
      }
      return await res.json();
    },
    onSuccess: () => {
      setIsReset(true);
      toast({
        title: "Пароль изменен!",
        description: "Теперь вы можете войти с новым паролем",
      });
      setTimeout(() => {
        setLocation("/auth");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetPasswordMutation.mutate({ email, code, newPassword, confirmPassword });
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
    // Start cooldown immediately to prevent spam
    setResendCooldown(30);
    resendMutation.mutate(email);
  };

  if (isReset) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <h2 className="text-2xl font-bold">Пароль изменен!</h2>
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
              <CardTitle>Сброс пароля</CardTitle>
              <CardDescription>
                Введите код из письма и создайте новый пароль
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-reset-email"
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
                    data-testid="input-reset-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Новый пароль</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-password"
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Сброс...
                    </>
                  ) : (
                    "Сбросить пароль"
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Не получили код?{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    className="p-0 h-auto underline"
                    onClick={handleResend}
                    disabled={resendMutation.isPending || resendCooldown > 0}
                    data-testid="button-resend-reset-code"
                  >
                    {resendMutation.isPending 
                      ? "Отправка..." 
                      : resendCooldown > 0 
                      ? `Повторить через ${resendCooldown} сек` 
                      : "Отправить повторно"}
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
          <h1 className="text-4xl font-serif font-bold">Новый пароль</h1>
          <p className="text-lg text-gray-300">
            Создайте надежный пароль для защиты вашего аккаунта
          </p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Минимум 6 символов</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Код действителен 15 минут</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Максимальная безопасность</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
