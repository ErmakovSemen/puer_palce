import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Home, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type VerificationStep = "register" | "verify-phone";
type ForgotStep = "phone" | "verify-code" | "new-password";

export default function Auth() {
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Login state
  const [loginData, setLoginData] = useState({ phone: "+7", password: "" });
  
  // Register state
  const [registerStep, setRegisterStep] = useState<VerificationStep>("register");
  const [registerData, setRegisterData] = useState({ 
    phone: "+7", 
    password: "", 
    name: "", 
    email: "" 
  });
  const [verificationCode, setVerificationCode] = useState("");
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("phone");
  const [forgotPhone, setForgotPhone] = useState("+7");
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // SMS resend timer (30 seconds)
  const [resendTimer, setResendTimer] = useState(0);

  // SMS sending mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { phone: string; type: "registration" | "password_reset" }) => {
      const res = await apiRequest("POST", "/api/auth/send-verification-code", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Код отправлен",
        description: "Проверьте SMS на вашем телефоне",
      });
      setResendTimer(30); // Start timer only on successful send
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка отправки кода",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Phone verification mutation
  const verifyPhoneMutation = useMutation({
    mutationFn: async (data: { phone: string; code: string; type: "registration" | "password_reset" }) => {
      const res = await apiRequest("POST", "/api/auth/verify-phone", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.user) {
        // Registration verification - user is now logged in
        queryClient.setQueryData(["/api/user"], data.user);
        toast({
          title: "Телефон подтверждён",
          description: "Добро пожаловать!",
        });
      } else if (data.verified) {
        // Password reset verification
        toast({
          title: "Код подтверждён",
          description: "Введите новый пароль",
        });
        setForgotStep("new-password");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка проверки кода",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { phone: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Пароль изменён",
        description: "Теперь вы можете войти с новым паролем",
      });
      setShowForgotPassword(false);
      setForgotStep("phone");
      setForgotPhone("");
      setForgotCode("");
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка сброса пароля",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  // Timer countdown effect
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Phone input handler with automatic +7 prefix
  const handlePhoneChange = (value: string) => {
    // Remove all non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // If user deletes the +7, restore it
    if (!cleaned.startsWith('+7')) {
      // If starts with 7 or 8, add +
      if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
        cleaned = '+7' + cleaned.slice(1);
      } else if (cleaned.length > 0 && cleaned !== '+') {
        // User typed a digit - prepend +7
        cleaned = '+7' + cleaned.replace(/^\+/, '');
      } else {
        // Empty or just +, set to +7
        cleaned = '+7';
      }
    }
    
    return cleaned;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build registration data
    const registrationData: any = {
      phone: registerData.phone,
      password: registerData.password,
      name: registerData.name,
    };
    
    // Only include email if it's not empty
    if (registerData.email && registerData.email.trim()) {
      registrationData.email = registerData.email;
    }
    
    const result: any = await registerMutation.mutateAsync(registrationData);
    
    // If registration successful, send SMS code
    if (result.userId) {
      await sendSmsMutation.mutateAsync({
        phone: registerData.phone,
        type: "registration",
      });
      setRegisterStep("verify-phone");
    }
  };

  const handleVerifyPhone = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPhoneMutation.mutate({
      phone: registerData.phone,
      code: verificationCode,
      type: "registration",
    });
  };

  const handleForgotPasswordPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await sendSmsMutation.mutateAsync({
      phone: forgotPhone,
      type: "password_reset",
    });
    setForgotStep("verify-code");
  };

  const handleForgotPasswordVerify = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPhoneMutation.mutate({
      phone: forgotPhone,
      code: forgotCode,
      type: "password_reset",
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    resetPasswordMutation.mutate({
      phone: forgotPhone,
      newPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Forgot password flow
  if (showForgotPassword) {
    return (
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotStep("phone");
                  setForgotPhone("");
                  setForgotCode("");
                  setNewPassword("");
                }}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к входу
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Восстановление пароля</CardTitle>
                <CardDescription>
                  {forgotStep === "phone" && "Введите номер телефона"}
                  {forgotStep === "verify-code" && "Введите код из SMS"}
                  {forgotStep === "new-password" && "Введите новый пароль"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {forgotStep === "phone" && (
                  <form onSubmit={handleForgotPasswordPhone} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-phone">Телефон</Label>
                      <Input
                        id="forgot-phone"
                        type="tel"
                        placeholder="+7 900 123-45-67"
                        value={forgotPhone}
                        onChange={(e) => setForgotPhone(handlePhoneChange(e.target.value))}
                        required
                        data-testid="input-forgot-phone"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={sendSmsMutation.isPending}
                      data-testid="button-send-code"
                    >
                      {sendSmsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Отправка...
                        </>
                      ) : (
                        "Отправить код"
                      )}
                    </Button>
                  </form>
                )}

                {forgotStep === "verify-code" && (
                  <form onSubmit={handleForgotPasswordVerify} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-code">Код из SMS</Label>
                      <Input
                        id="forgot-code"
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value)}
                        required
                        data-testid="input-forgot-code"
                      />
                      <p className="text-xs text-muted-foreground">
                        Код действителен 5 минут
                      </p>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={verifyPhoneMutation.isPending}
                      data-testid="button-verify-code"
                    >
                      {verifyPhoneMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Проверка...
                        </>
                      ) : (
                        "Подтвердить"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        sendSmsMutation.mutate({
                          phone: forgotPhone,
                          type: "password_reset",
                        });
                      }}
                      disabled={sendSmsMutation.isPending || resendTimer > 0}
                      data-testid="button-resend-code"
                    >
                      {resendTimer > 0 
                        ? `Отправить повторно (${resendTimer}с)` 
                        : "Отправить код повторно"}
                    </Button>
                  </form>
                )}

                {forgotStep === "new-password" && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Новый пароль</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Минимум 6 символов"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        data-testid="input-new-password"
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
                          Сохранение...
                        </>
                      ) : (
                        "Сохранить новый пароль"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hero Section */}
        <div className="hidden lg:flex bg-black text-white items-center justify-center p-12">
          <div className="max-w-md space-y-6">
            <h1 className="text-4xl font-serif font-bold">Восстановление пароля</h1>
            <p className="text-lg text-gray-300">
              Мы отправим вам SMS с кодом для подтверждения
            </p>
          </div>
        </div>
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
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="tab-login">Вход</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Регистрация</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Войти в аккаунт</CardTitle>
                  <CardDescription>
                    Введите ваш телефон и пароль для входа
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-phone">Телефон</Label>
                      <Input
                        id="login-phone"
                        type="tel"
                        placeholder="+7 900 123-45-67"
                        value={loginData.phone}
                        onChange={(e) => setLoginData({ ...loginData, phone: handlePhoneChange(e.target.value) })}
                        required
                        data-testid="input-login-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Пароль</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        data-testid="input-login-password"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-0 h-auto"
                      onClick={() => setShowForgotPassword(true)}
                      data-testid="button-forgot-password"
                    >
                      Забыли пароль?
                    </Button>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Вход...
                        </>
                      ) : (
                        "Войти"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Создать аккаунт</CardTitle>
                  <CardDescription>
                    {registerStep === "register" 
                      ? "Заполните данные для регистрации"
                      : "Введите код из SMS для подтверждения"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {registerStep === "register" ? (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-phone">Телефон</Label>
                        <Input
                          id="register-phone"
                          type="tel"
                          placeholder="+7 900 123-45-67"
                          value={registerData.phone}
                          onChange={(e) => setRegisterData({ ...registerData, phone: handlePhoneChange(e.target.value) })}
                          required
                          data-testid="input-register-phone"
                        />
                        <p className="text-xs text-muted-foreground">
                          Будет отправлен SMS с кодом подтверждения
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-name">Имя</Label>
                        <Input
                          id="register-name"
                          type="text"
                          placeholder="Как к вам обращаться?"
                          value={registerData.name}
                          onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                          required
                          data-testid="input-register-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-password">Пароль</Label>
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Минимум 6 символов"
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          required
                          minLength={6}
                          data-testid="input-register-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-email">Email (необязательно)</Label>
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="name@example.com"
                          value={registerData.email}
                          onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                          data-testid="input-register-email"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Регистрация...
                          </>
                        ) : (
                          "Зарегистрироваться"
                        )}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPhone} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="verification-code">Код из SMS</Label>
                        <Input
                          id="verification-code"
                          type="text"
                          placeholder="123456"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          required
                          data-testid="input-verification-code"
                        />
                        <p className="text-xs text-muted-foreground">
                          Код отправлен на {registerData.phone}. Действителен 5 минут.
                        </p>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={verifyPhoneMutation.isPending}
                        data-testid="button-verify"
                      >
                        {verifyPhoneMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Проверка...
                          </>
                        ) : (
                          "Подтвердить телефон"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          sendSmsMutation.mutate({
                            phone: registerData.phone,
                            type: "registration",
                          });
                        }}
                        disabled={sendSmsMutation.isPending || resendTimer > 0}
                        data-testid="button-resend"
                      >
                        {resendTimer > 0 
                          ? `Отправить повторно (${resendTimer}с)` 
                          : "Отправить код повторно"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setRegisterStep("register");
                          setVerificationCode("");
                        }}
                        data-testid="button-change-phone"
                      >
                        Изменить номер телефона
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hidden lg:flex bg-black text-white items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-serif font-bold">Добро пожаловать в Puer Pub</h1>
          <p className="text-lg text-gray-300">
            Создайте аккаунт, чтобы отслеживать ваши заказы и получать бонусы
          </p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>История всех ваших заказов</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Программа лояльности с уровнями и скидками</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Защита по SMS-верификации</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
