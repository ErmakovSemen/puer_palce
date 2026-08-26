import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { venue } from "@/lib/landingConfigs";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Появление блока при скролле: аккуратный fade-up, отключается при reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={reduce ? undefined : { opacity: 0, y: 26 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={align === "center" ? "text-center" : ""}>
      <p className="landing-eyebrow">{eyebrow}</p>
      <h2 className="landing-display mt-4 text-[clamp(2.2rem,5vw,3.6rem)]">{title}</h2>
      {lead && (
        <p
          className={`mt-5 max-w-xl text-base leading-relaxed sm:text-lg ${align === "center" ? "mx-auto" : ""}`}
          style={{ color: "var(--ink-soft)" }}
        >
          {lead}
        </p>
      )}
    </Reveal>
  );
}

function minutesInMoscow(now: Date) {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Открыта ли чайная прямо сейчас (по московскому времени). */
export function useIsOpenNow() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      const now = minutesInMoscow(new Date());
      const open = toMinutes(venue.hours.open);
      const close = toMinutes(venue.hours.close);
      setIsOpen(close > open ? now >= open && now < close : now >= open || now < close);
    };

    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return isOpen;
}

export function OpenBadge() {
  const isOpen = useIsOpenNow();
  if (isOpen === null) return null;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        borderColor: "var(--ink-faint)",
        color: isOpen ? "var(--jade)" : "var(--ink-soft)",
      }}
    >
      <span
        className="relative flex h-2 w-2"
        aria-hidden="true"
      >
        {isOpen && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ backgroundColor: "var(--jade)" }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: isOpen ? "var(--jade)" : "var(--ink-soft)" }}
        />
      </span>
      {isOpen ? "Сейчас открыто" : "Сейчас закрыто"}
    </span>
  );
}
