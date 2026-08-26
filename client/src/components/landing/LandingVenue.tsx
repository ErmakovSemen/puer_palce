import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { SiVk } from "react-icons/si";
import { venue } from "@/lib/landingConfigs";
import { OpenBadge, Reveal, SectionHeading, staggerContainer, staggerItem } from "./primitives";

const contacts = [
  {
    label: "Позвонить",
    value: venue.phone,
    href: venue.phoneHref,
    Icon: Phone,
  },
  {
    label: "Telegram",
    value: venue.telegram,
    href: venue.telegramHref,
    Icon: Send,
  },
  {
    label: "ВКонтакте",
    value: venue.vk,
    href: venue.vkHref,
    Icon: SiVk,
  },
  {
    label: "Почта",
    value: venue.email,
    href: `mailto:${venue.email}`,
    Icon: Mail,
  },
];

/** Адрес, карта, часы работы и способы связи. */
export const LandingVenue = forwardRef<HTMLElement>((_props, ref) => {
  const reduce = useReducedMotion();

  return (
    <section
      id="venue"
      ref={ref}
      className="scroll-mt-24"
      style={{ backgroundColor: "var(--paper-deep)" }}
    >
      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28 lg:px-10">
        <SectionHeading
          eyebrow="Контакты"
          title="Найти нас"
          lead={`${venue.city}, ${venue.address}. ${venue.addressHint}.`}
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal className="overflow-hidden rounded-2xl" >
            <div style={{ border: "1px solid var(--ink-faint)", borderRadius: "1rem", overflow: "hidden" }}>
              <iframe
                src={venue.mapsEmbed}
                title={`Пуэр Паб на карте: ${venue.city}, ${venue.address}`}
                loading="lazy"
                className="h-[320px] w-full border-0 sm:h-[440px]"
                allowFullScreen
              />
            </div>
            <a
              href={venue.mapsHref}
              target="_blank"
              rel="noreferrer"
              className="landing-btn landing-btn-ghost mt-4 w-full sm:w-auto"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Построить маршрут
            </a>
          </Reveal>

          <div className="flex flex-col gap-4">
            <Reveal
              className="rounded-2xl px-6 py-6"
            >
              <div style={{ backgroundColor: "var(--paper-card)", border: "1px solid var(--ink-faint)", borderRadius: "1rem", padding: "1.5rem" }}>
                <div className="flex items-center justify-between gap-4">
                  <p className="landing-eyebrow flex items-center gap-2">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Часы работы
                  </p>
                  <OpenBadge />
                </div>
                <p className="landing-display mt-4 text-3xl">
                  {venue.hours.open} — {venue.hours.close}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                  {venue.hours.label}
                </p>
              </div>
            </Reveal>

            <motion.ul
              className="grid gap-3 sm:grid-cols-2"
              variants={staggerContainer}
              initial={reduce ? undefined : "hidden"}
              whileInView={reduce ? undefined : "visible"}
              viewport={{ once: true, margin: "-60px" }}
            >
              {contacts.map(({ label, value, href, Icon }) => (
                <motion.li key={label} variants={staggerItem}>
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                    className="group flex h-full flex-col justify-between gap-6 rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
                    style={{ backgroundColor: "var(--paper-card)", border: "1px solid var(--ink-faint)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: "var(--shu)" }} aria-hidden="true" />
                    <span>
                      <span className="landing-eyebrow block">{label}</span>
                      <span className="mt-1 block text-sm font-medium">{value}</span>
                    </span>
                  </a>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </div>
      </div>
    </section>
  );
});

LandingVenue.displayName = "LandingVenue";
