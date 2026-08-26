import { useEffect, useMemo, useRef } from "react";
import { useRoute, useSearch } from "wouter";
import { landingConfigs, resolveVariant } from "@/lib/landingConfigs";
import { LandingHero } from "@/components/landing/LandingHero";
import { CeremonyRitual } from "@/components/landing/CeremonyRitual";
import { LandingDetails } from "@/components/landing/LandingDetails";
import { LandingVenue } from "@/components/landing/LandingVenue";
import { BookingForm } from "@/components/landing/BookingForm";
import { LandingFooter, LandingNav } from "@/components/landing/LandingChrome";
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
    const meta = document.querySelector('meta[name="description"]');
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", config.seoDescription);

    return () => {
      if (meta && previous) meta.setAttribute("content", previous);
    };
  }, [config]);

  const scrollTo = (target: React.RefObject<HTMLElement>) => {
    target.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landing landing-grain relative min-h-screen">
      <LandingNav ctaLabel={config.hero.primaryCta} onBookClick={() => scrollTo(bookingRef)} />

      <main className="relative z-10">
        <LandingHero
          config={config}
          onBookClick={() => scrollTo(bookingRef)}
          onDirectionsClick={() => scrollTo(venueRef)}
        />
        <LandingDetails config={config} />
        <CeremonyRitual config={config} />
        <LandingVenue ref={venueRef} />
        <BookingForm ref={bookingRef} config={config} utm={utm} />
      </main>

      <LandingFooter />
    </div>
  );
}
