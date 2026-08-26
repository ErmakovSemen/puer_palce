import { useState } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle, Smartphone, Gift } from "lucide-react";

const Q4_CUSTOM = "Свой вариант";
const Q5_CUSTOM = "Свой вариант";

const waitlistSchema = z.object({
  name: z.string().min(2, "Введите имя (минимум 2 символа)"),
  phone: z.string().min(10, "Введите корректный номер телефона"),
  telegram: z.string().optional().nullable(),
  email: z.string().email("Введите корректный email").optional().or(z.literal("")),
  consent: z.literal(true, { errorMap: () => ({ message: "Необходимо согласие" }) }),
  surveyQ1: z.string().optional().nullable(),
  surveyQ2: z.string().optional().nullable(),
  surveyQ3: z.string().optional().nullable(),
  surveyQ4: z.string().optional().nullable(),
  surveyQ4Custom: z.string().optional().nullable(),
  surveyQ5: z.string().optional().nullable(),
  surveyQ5Custom: z.string().optional().nullable(),
});

type WaitlistForm = z.infer<typeof waitlistSchema>;
type SurveyFieldName = "surveyQ1" | "surveyQ2" | "surveyQ3" | "surveyQ4" | "surveyQ5";
type SurveyCustomFieldName = "surveyQ4Custom" | "surveyQ5Custom";

const Q1_OPTIONS = [
  "Не пробовал(а)",
  "1 раз",
  "Несколько раз",
  "Периодически пью",
  "Пью часто и очень люблю его",
];

const Q2_OPTIONS = [
  "Дома",
  "На работе",
  "Во время тренировок",
  "В дороге",
  "В любой удобной ситуации",
];

const Q3_OPTIONS = [
  "Однозначно да",
  "Скорее да",
  "Скорее нет",
  "Однозначно нет",
  "Не знаю, но купил бы попробовать",
];

const Q4_OPTIONS = [
  "Большего разнообразия добавок",
  "Больше готовых рецептов",
  "Более низкой цены",
  "Большей нацеленности на функциональность (расслабление, бодрость, концентрация, энергия и т.д.)",
  "Большего разнообразия чаёв в ассортименте",
  "Всего хватает",
  Q4_CUSTOM,
];

const Q5_OPTIONS = [
  "Свобода действий для создания своего чая",
  "Возможность добавлять в чай ягоды и травы",
  "Удобство в заваривании «сложного» чая",
  "Демо-интерфейс приложения",
  "Красивая упаковка",
  "Доставка на маркетплейсы",
  "Ничего из вышеперечисленного",
  Q5_CUSTOM,
];

function SurveyQuestion({
  number,
  question,
  options,
  fieldName,
  customFieldName,
  control,
}: {
  number: number;
  question: string;
  options: string[];
  fieldName: SurveyFieldName;
  customFieldName?: SurveyCustomFieldName;
  control: Control<WaitlistForm>;
}) {
  const selected = useWatch({ control, name: fieldName });
  const showCustom = customFieldName && selected === (fieldName === "surveyQ4" ? Q4_CUSTOM : Q5_CUSTOM);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium leading-snug">
        <span className="text-muted-foreground">{number}.</span> {question}
      </p>
      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RadioGroup
                value={field.value ?? ""}
                onValueChange={field.onChange}
                className="flex flex-col gap-2"
                data-testid={`survey-q${number}`}
              >
                {options.map((option) => (
                  <div key={option} className="flex items-start gap-2">
                    <RadioGroupItem
                      value={option}
                      id={`${fieldName}-${option}`}
                      data-testid={`radio-${fieldName}-${option}`}
                      className="mt-0.5 shrink-0"
                    />
                    <Label
                      htmlFor={`${fieldName}-${option}`}
                      className="text-sm font-normal leading-snug cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {showCustom && customFieldName && (
        <FormField
          control={control}
          name={customFieldName}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  data-testid={`textarea-${customFieldName}`}
                  placeholder="Напишите свой вариант..."
                  className="text-sm resize-none"
                  rows={2}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

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
      surveyQ1: "",
      surveyQ2: "",
      surveyQ3: "",
      surveyQ4: "",
      surveyQ4Custom: "",
      surveyQ5: "",
      surveyQ5Custom: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: WaitlistForm) => {
      const payload = {
        ...data,
        telegram: data.telegram || null,
        email: data.email || null,
        surveyQ1: data.surveyQ1 || null,
        surveyQ2: data.surveyQ2 || null,
        surveyQ3: data.surveyQ3 || null,
        surveyQ4: data.surveyQ4 || null,
        surveyQ4Custom: data.surveyQ4 === Q4_CUSTOM ? (data.surveyQ4Custom || null) : null,
        surveyQ5: data.surveyQ5 || null,
        surveyQ5Custom: data.surveyQ5 === Q5_CUSTOM ? (data.surveyQ5Custom || null) : null,
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
      <div className="w-full max-w-lg">

        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="p-4 bg-muted rounded-full">
            <Smartphone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-serif font-semibold">Приложение ещё в разработке</h1>
          <p className="text-muted-foreground leading-relaxed">
            Оставьте заявку и будьте в курсе обновлений — получите{" "}
            <span className="font-semibold text-foreground">скидку 50%</span> на первый заказ
            сразу после релиза!
          </p>
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-4 py-3 text-left w-full">
            <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">
              Пройдите короткий опрос вместе с заявкой — и получите{" "}
              <span className="font-semibold">подарок к первому заказу</span>!
            </p>
          </div>
        </div>

        {submitted ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <h2 className="text-xl font-semibold">Вы в списке!</h2>
              <p className="text-muted-foreground">
                Мы свяжемся с вами сразу после релиза, пришлём промокод на скидку 50%{" "}
                и подготовим для вас{" "}
                <span className="font-semibold text-foreground">подарок к первому заказу</span>.
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
                        <FormLabel>Ник в Телеграме <span className="text-muted-foreground font-normal">(необязательно)</span></FormLabel>
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
                        <FormLabel>Электронная почта <span className="text-muted-foreground font-normal">(необязательно)</span></FormLabel>
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

                  <div className="border-t pt-4 mt-2">
                    <Card className="bg-muted/40">
                      <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Короткий опрос
                          <span className="text-muted-foreground font-normal">(необязательно)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 flex flex-col gap-6">
                        <SurveyQuestion
                          number={1}
                          question="Пробовали ли вы ранее китайский чай?"
                          options={Q1_OPTIONS}
                          fieldName="surveyQ1"
                          control={form.control}
                        />
                        <SurveyQuestion
                          number={2}
                          question="Где бы вы пили чай, который увидели?"
                          options={Q2_OPTIONS}
                          fieldName="surveyQ2"
                          control={form.control}
                        />
                        <SurveyQuestion
                          number={3}
                          question="Нравится ли вам тот продукт, который вы увидели?"
                          options={Q3_OPTIONS}
                          fieldName="surveyQ3"
                          control={form.control}
                        />
                        <SurveyQuestion
                          number={4}
                          question="Чего, как вам кажется, не хватает Чайному Ритму?"
                          options={Q4_OPTIONS}
                          fieldName="surveyQ4"
                          customFieldName="surveyQ4Custom"
                          control={form.control}
                        />
                        <SurveyQuestion
                          number={5}
                          question="Что больше всего понравилось в продукте?"
                          options={Q5_OPTIONS}
                          fieldName="surveyQ5"
                          customFieldName="surveyQ5Custom"
                          control={form.control}
                        />
                      </CardContent>
                    </Card>
                  </div>

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

                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                    data-testid="link-go-to-shop"
                  >
                    <a href="/">Перейти на сайт и заказать чай</a>
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
