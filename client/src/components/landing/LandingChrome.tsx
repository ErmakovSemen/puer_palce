import { motion, useScroll, useSpring } from "framer-motion";
import { CalendarCheck, Phone } from "lucide-react";
import { venue } from "@/lib/landingConfigs";

/** Верхняя панель: полоса прогресса чтения, телефон и постоянная кнопка записи. */
export function LandingNav({ ctaLabel, onBookClick }: { ctaLabel: string; onBookClick: () => void }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className="backdrop-blur-md"
        style={{ backgroundColor: "rgba(244,240,232,0.82)", borderBottom: "1px solid var(--ink-faint)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3 lg:px-10">
          <a href="/" className="flex items-baseline gap-2">
            <span className="landing-display text-xl">Пуэр Паб</span>
            <span className="landing-han text-sm" style={{ color: "var(--ink-soft)" }} aria-hidden="true">
              茶
            </span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href={venue.phoneHref}
              className="hidden items-center gap-2 text-sm font-medium sm:flex"
              style={{ color: "var(--ink-soft)" }}
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {venue.phone}
            </a>
            <button
              type="button"
              onClick={onBookClick}
              className="landing-btn landing-btn-primary !px-5 !py-2.5 !text-sm"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
      <motion.div
        className="h-[2px] origin-left"
        style={{ scaleX: progress, backgroundColor: "var(--shu)" }}
        aria-hidden="true"
      />
    </header>
  );
}

/** Постоянный CTA для телефона: на длинной странице запись всегда в одном нажатии. */
export function LandingMobileBookingCta({ onBookClick }: { onBookClick: () => void }) {
  return (
    <div className="landing-mobile-booking sm:hidden">
      <button type="button" onClick={onBookClick} className="landing-btn landing-btn-primary">
        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        Записаться на церемонию
      </button>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}>
      <div className="mx-auto w-full max-w-7xl px-6 py-14 lg:px-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="landing-display text-3xl">Пуэр Паб</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(244,240,232,0.65)" }}>
              {venue.city}, {venue.address}
              <br />
              {venue.addressHint}
            </p>
          </div>

          <nav className="flex flex-col gap-2 text-sm">
            <a href={venue.telegramHref} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
              Telegram {venue.telegram}
            </a>
            <a href={venue.vkHref} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
              ВКонтакте
            </a>
            <a href={venue.phoneHref} className="hover:underline underline-offset-4">
              {venue.phone}
            </a>
            <a href={`mailto:${venue.email}`} className="hover:underline underline-offset-4">
              {venue.email}
            </a>
            <a href="/" className="mt-2 hover:underline underline-offset-4" style={{ color: "var(--gold)" }}>
              Магазин чая →
            </a>
          </nav>
        </div>

        <p className="mt-12 text-xs" style={{ color: "rgba(244,240,232,0.45)" }}>
          Отправляя форму, вы соглашаетесь на обработку персональных данных. Данные используем только для подтверждения записи.
        </p>
      </div>
    </footer>
  );
}
