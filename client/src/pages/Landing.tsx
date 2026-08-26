import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useRoute, useSearch } from "wouter";
import { landingConfigs, resolveVariant } from "@/lib/landingConfigs";
import { LandingHero } from "@/components/landing/LandingHero";
import { CeremonyRitual } from "@/components/landing/CeremonyRitual";
import { LandingDetails } from "@/components/landing/LandingDetails";
import { LandingVenue } from "@/components/landing/LandingVenue";
import { BookingForm } from "@/components/landing/BookingForm";
import { LandingFooter, LandingMobileBookingCta, LandingNav } from "@/components/landing/LandingChrome";
import { METRIKA_GOALS, trackEvent } from "@/lib/metrics";
import "@/styles/landing.css";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"];

/**
 * Моно-лендинг. Одна страница, версия берётся из адреса (/l/ceremony, /l/tea, /l/gift),
 * рекламные метки уезжают вместе с заявкой в базу.
 */
export default function Landing() {
  const [, params] = useRoute("/l/:variant");
  const search = useSearch();

  const config = landingConfigs[resolveVariant(params?.variant)];

  const utm = useMemo(() => {
    const query = new URLSearchParams(search);
    const collected: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = query.get(key);
      if (value) collected[key] = value.slice(0, 200);
    }
    return collected;
  }, [search]);

  const bookingRef = useRef<HTMLElement>(null);
  const venueRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = config.seoTitle;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", config.seoDescription);

    return () => {
      if (previous) {
        meta.setAttribute("content", previous);
      }
    };
  }, [config]);

  const scrollTo = (target: RefObject<HTMLElement>) => {
    target.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBookingCtaClick = (source: "navigation" | "hero" | "mobile") => {
    trackEvent(METRIKA_GOALS.ceremonyBookingCtaClick, { source, variant: config.variant });
    scrollTo(bookingRef);
  };

  return (
    <div className="landing landing-grain relative min-h-screen">
      <LandingNav ctaLabel={config.hero.primaryCta} onBookClick={() => handleBookingCtaClick("navigation")} />

      <main className="relative z-10">
        <LandingHero
          config={config}
          onBookClick={() => handleBookingCtaClick("hero")}
          onDirectionsClick={() => scrollTo(venueRef)}
        />
        <LandingDetails config={config} />
        <CeremonyRitual config={config} />
        <BookingForm ref={bookingRef} config={config} utm={utm} />
        <LandingVenue ref={venueRef} />
      </main>

      <LandingMobileBookingCta onBookClick={() => handleBookingCtaClick("mobile")} />
      <LandingFooter />
    </div>
  );
}
