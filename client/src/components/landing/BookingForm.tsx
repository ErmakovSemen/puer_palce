import { forwardRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Minus, Plus, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { METRIKA_GOALS, trackEvent } from "@/lib/metrics";
import type { LandingConfig } from "@/lib/landingConfigs";
import { venue } from "@/lib/landingConfigs";
import { Reveal, SectionHeading } from "./primitives";

const bookingSchema = z.object({
  name: z.string().min(2, "Введите имя — минимум две буквы"),
  phone: z
    .string()
    .min(10, "Введите номер телефона полностью")
    .regex(/^[\d\s()+-]+$/, "В номере только цифры, скобки и дефисы"),
  guests: z.coerce.number().int().min(1).max(20),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  telegram: z.string().max(64).optional(),
  comment: z.string().max(1000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Без согласия мы не сможем вам перезвонить" }) }),
  website: z.string().optional(), // honeypot
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const TIME_SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

function today() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export const BookingForm = forwardRef<HTMLElement, { config: LandingConfig; utm: Record<string, string> }>(
  ({ config, utm }, ref) => {
    const reduce = useReducedMotion();
    const [done, setDone] = useState(false);

    const form = useForm<BookingFormValues>({
      resolver: zodResolver(bookingSchema),
      defaultValues: {
        name: "",
        phone: "",
        guests: 2,
        preferredDate: "",
        preferredTime: "",
        telegram: "",
        comment: "",
        website: "",
      },
    });

    const guests = form.watch("guests");

    const mutation = useMutation({
      mutationFn: async (values: BookingFormValues) => {
        const res = await apiRequest("POST", "/api/landing/booking", {
          name: values.name.trim(),
          phone: values.phone.trim(),
          guests: config.form.showGuests ? Number(values.guests) : 1,
          preferredDate: values.preferredDate || null,
          preferredTime: values.preferredTime || null,
          telegram: values.telegram?.trim() || null,
          comment: values.comment?.trim() || null,
          consent: true,
          variant: config.variant,
          utm: Object.keys(utm).length > 0 ? JSON.stringify(utm) : null,
          website: values.website,
        });
        return res.json();
      },
      onSuccess: (_data, values) => {
        trackEvent(METRIKA_GOALS.ceremonyBookingSubmitted, {
          variant: config.variant,
          guests: config.form.showGuests ? Number(values.guests) : 1,
        });
        setDone(true);
        form.reset();
      },
    });

    const setGuests = (next: number) => {
      form.setValue("guests", Math.min(config.maxGuests, Math.max(1, next)), { shouldValidate: true });
    };

    return (
      <section id="booking" ref={ref} className="scroll-mt-24">
        <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-24 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <SectionHeading eyebrow={config.form.eyebrow} title={config.form.title} lead={config.form.lead} />
              <Reveal delay={0.15}>
                <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  Не любите формы? Напишите прямо в{" "}
                  <a
                    href={venue.telegramHref}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                    style={{ color: "var(--shu)" }}
                    onClick={() => trackEvent(METRIKA_GOALS.ceremonyMessengerClick, { source: "booking_form" })}
                  >
                    Telegram
                  </a>{" "}
                  или позвоните{" "}
                  <a href={venue.phoneHref} className="underline underline-offset-4" style={{ color: "var(--shu)" }}>
                    {venue.phone}
                  </a>
                  .
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <div
                className="rounded-2xl p-5 sm:rounded-3xl sm:p-9"
                style={{ backgroundColor: "var(--paper-card)", border: "1px solid var(--ink-faint)" }}
              >
                {done ? (
                  <motion.div
                    className="flex min-h-[22rem] flex-col items-center justify-center text-center"
                    initial={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                    animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <span
                      className="flex h-16 w-16 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--jade)" }}
                    >
                      <Check className="h-8 w-8 text-white" aria-hidden="true" />
                    </span>
                    <h3 className="landing-display mt-6 text-3xl">{config.form.successTitle}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                      {config.form.successText}
                    </p>
                    <a
                      href={venue.telegramHref}
                      target="_blank"
                      rel="noreferrer"
                      className="landing-btn landing-btn-ghost mt-8"
                      onClick={() => trackEvent(METRIKA_GOALS.ceremonyMessengerClick, { source: "booking_success" })}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Написать в Telegram
                    </a>
                  </motion.div>
                ) : (
                  <form
                    onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                    className="flex flex-col gap-5"
                    noValidate
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="landing-label" htmlFor="booking-name">
                          Как вас зовут
                        </label>
                        <input
                          id="booking-name"
                          className="landing-field"
                          placeholder="Семён"
                          autoComplete="name"
                          {...form.register("name")}
                        />
                        {form.formState.errors.name && (
                          <p className="landing-error">{form.formState.errors.name.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="landing-label" htmlFor="booking-phone">
                          Телефон
                        </label>
                        <input
                          id="booking-phone"
                          className="landing-field"
                          type="tel"
                          inputMode="tel"
                          placeholder="+7 900 000-00-00"
                          autoComplete="tel"
                          {...form.register("phone")}
                        />
                        {form.formState.errors.phone && (
                          <p className="landing-error">{form.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>

                    {config.form.showDate && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <label className="landing-label" htmlFor="booking-date">
                            Дата
                          </label>
                          <input
                            id="booking-date"
                            className="landing-field"
                            type="date"
                            min={today()}
                            {...form.register("preferredDate")}
                          />
                        </div>
                        <div>
                          <label className="landing-label" htmlFor="booking-time">
                            Время (по желанию)
                          </label>
                          <select id="booking-time" className="landing-field" {...form.register("preferredTime")}>
                            <option value="">Не выбирать</option>
                            {TIME_SLOTS.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {config.form.showGuests && (
                      <div>
                        <span className="landing-label">Сколько вас будет</span>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setGuests(Number(guests) - 1)}
                            disabled={Number(guests) <= 1}
                            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ border: "1px solid var(--ink-faint)" }}
                            aria-label="Убрать гостя"
                          >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <span className="landing-display w-10 text-center text-3xl" aria-live="polite">
                            {guests}
                          </span>
                          <button
                            type="button"
                            onClick={() => setGuests(Number(guests) + 1)}
                            disabled={Number(guests) >= config.maxGuests}
                            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ border: "1px solid var(--ink-faint)" }}
                            aria-label="Добавить гостя"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ловушка для ботов: человек этого поля не видит */}
                    <input
                      {...form.register("website")}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="hidden"
                    />

                    <label className="flex cursor-pointer items-start gap-3 text-sm" style={{ color: "var(--ink-soft)" }}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--shu)]"
                        {...form.register("consent")}
                      />
                      <span>Согласен на обработку персональных данных и звонок для подтверждения записи</span>
                    </label>
                    {form.formState.errors.consent && (
                      <p className="landing-error -mt-3">{form.formState.errors.consent.message}</p>
                    )}

                    {mutation.isError && (
                      <p className="landing-error" role="alert">
                        {(mutation.error as Error).message}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="landing-btn landing-btn-primary mt-1 w-full"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Отправляем
                        </>
                      ) : (
                        config.form.submit
                      )}
                    </button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    );
  }
);

BookingForm.displayName = "BookingForm";
