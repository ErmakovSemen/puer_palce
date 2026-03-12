import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle, Smartphone } from "lucide-react";

const waitlistSchema = z.object({
  name: z.string().min(2, "Введите имя (минимум 2 символа)"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  telegram: z.string().optional().nullable(),
  email: z.string().email("Введите корректный email").optional().or(z.literal("")),
  consent: z.literal(true, { errorMap: () => ({ message: "Необходимо согласие" }) }),
});

type WaitlistForm = z.infer<typeof waitlistSchema>;

export default function AppWaitlist() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<WaitlistForm>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      name: "",
      phone: "",
      telegram: "",
      email: "",
      consent: undefined as unknown as true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: WaitlistForm) => {
      const payload = {
        ...data,
        telegram: data.telegram || null,
        email: data.email || null,
      };
      return apiRequest("POST", "/api/waitlist", payload);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  function onSubmit(data: WaitlistForm) {
    mutation.mutate(data);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="p-4 bg-muted rounded-full">
            <Smartphone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-serif font-semibold">Приложение ещё в разработке</h1>
          <p className="text-muted-foreground leading-relaxed">
            Оставьте свои контактные данные, будьте в курсе обновлений и получите{" "}
            <span className="font-semibold text-foreground">скидку 50%</span> на первый заказ
            сразу после релиза!
          </p>
        </div>

        {submitted ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <h2 className="text-xl font-semibold">Вы в списке!</h2>
              <p className="text-muted-foreground">
                Мы свяжемся с вами сразу после релиза и пришлём промокод на скидку 50%.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-name"
                            placeholder="Ваше имя"
                            {...field}
                          />
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
                        <FormLabel>Номер телефона *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-phone"
                            placeholder="+7 999 000 00 00"
                            type="tel"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ник в Телеграме</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-telegram"
                            placeholder="@username"
                            {...field}
                            value={field.value ?? ""}
                          />
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
                        <FormLabel>Электронная почта</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-email"
                            placeholder="example@mail.ru"
                            type="email"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="consent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start gap-3 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            data-testid="checkbox-consent"
                            checked={field.value === true}
                            onCheckedChange={(checked) => field.onChange(checked ? true : undefined)}
                          />
                        </FormControl>
                        <div className="leading-snug">
                          <FormLabel className="cursor-pointer font-normal text-sm">
                            Я согласен с{" "}
                            <span className="underline underline-offset-2">пользовательским соглашением</span>{" "}
                            и даю согласие на обработку персональных данных
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {mutation.isError && (
                    <p className="text-sm text-destructive text-center">
                      Произошла ошибка. Попробуйте ещё раз.
                    </p>
                  )}

                  <Button
                    data-testid="button-submit-waitlist"
                    type="submit"
                    className="w-full"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? "Отправка..." : "Оставить заявку"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
