import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Home, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const forgotPasswordMutation = useMutation({
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
      // Redirect to reset password page with email pre-filled
      setLocation(`/reset-password?email=${encodeURIComponent(email)}`);
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
    forgotPasswordMutation.mutate(email);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Form Section */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Navigation */}
          <div className="mb-6 flex gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <Home className="h-4 w-4 mr-2" />
                На главную
              </Button>
            </Link>
            <Link href="/auth">
              <Button variant="ghost" size="sm" data-testid="button-back-to-login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к входу
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Забыли пароль?</CardTitle>
              <CardDescription>
                Введите ваш email и мы отправим вам код для сброса пароля
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
                    data-testid="input-forgot-password-email"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={forgotPasswordMutation.isPending}
                  data-testid="button-send-reset-code"
                >
                  {forgotPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    "Отправить код"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hidden lg:flex bg-black text-white items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-serif font-bold">Восстановление пароля</h1>
          <p className="text-lg text-gray-300">
            Не переживайте! Мы поможем вам восстановить доступ к аккаунту
          </p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Безопасный процесс сброса пароля</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Код действителен 15 минут</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Надежная защита вашего аккаунта</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
