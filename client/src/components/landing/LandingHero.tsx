import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowDown, MapPin } from "lucide-react";
import type { LandingConfig } from "@/lib/landingConfigs";
import { venue } from "@/lib/landingConfigs";
import { OpenBadge } from "./primitives";
import { InkCup } from "./InkCup";

const EASE = [0.22, 1, 0.36, 1] as const;

export function LandingHero({
  config,
  onBookClick,
  onDirectionsClick,
}: {
  config: LandingConfig;
  onBookClick: () => void;
  onDirectionsClick: () => void;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  const rise = (delay: number) => ({
    initial: reduce ? undefined : { opacity: 0, y: 24 },
    animate: reduce ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <section ref={ref} className="relative isolate overflow-hidden">
      {/* Водяной знак «чай» */}
      <span
        aria-hidden="true"
        className="landing-han pointer-events-none absolute -right-[6vw] top-[6vh] select-none text-[42vw] leading-none sm:text-[34vw] lg:text-[26vw]"
        style={{ color: "rgba(34,26,21,0.045)" }}
      >
        茶
      </span>

      <div className="relative mx-auto grid min-h-[92vh] w-full max-w-7xl items-center gap-12 px-6 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10">
        <motion.div style={reduce ? undefined : { y: textY }}>
          <motion.p className="landing-eyebrow" {...rise(0.05)}>
            {config.hero.eyebrow}
          </motion.p>

          <h1 className="landing-display mt-6 text-[clamp(3.2rem,10vw,7rem)]">
            <motion.span className="block" {...rise(0.15)}>
              {config.hero.title}
            </motion.span>
            <motion.span className="relative block" style={{ color: "var(--shu)" }} {...rise(0.25)}>
              {config.hero.titleAccent}
              {/* Мазок тушью прорисовывается под словом */}
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 420 26"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-4 w-[min(100%,26rem)]"
              >
                <motion.path
                  d="M4 17 C 70 6, 140 22, 208 12 S 350 4, 416 14"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
                  animate={reduce ? undefined : { pathLength: 1, opacity: 0.85 }}
                  transition={{ duration: 1.3, delay: 0.7, ease: EASE }}
                />
              </motion.svg>
            </motion.span>
          </h1>

          <motion.p
            className="mt-8 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--ink-soft)" }}
            {...rise(0.4)}
          >
            {config.hero.lead}
          </motion.p>

          <motion.div className="mt-10 flex flex-wrap items-center gap-4" {...rise(0.5)}>
            <button type="button" onClick={onBookClick} className="landing-btn landing-btn-primary">
              {config.hero.primaryCta}
            </button>
            <button type="button" onClick={onDirectionsClick} className="landing-btn landing-btn-ghost">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {config.hero.secondaryCta}
            </button>
          </motion.div>

          <motion.div
            className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm"
            style={{ color: "var(--ink-soft)" }}
            {...rise(0.6)}
          >
            <OpenBadge />
            <span>
              {venue.city}, {venue.address}
            </span>
          </motion.div>
        </motion.div>

        <motion.div className="relative" {...rise(0.35)}>
          <InkCup />
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={onBookClick}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] lg:flex"
        style={{ color: "var(--ink-soft)" }}
        initial={reduce ? undefined : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <motion.span
          animate={reduce ? undefined : { y: [0, 5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </motion.span>
        Ниже
      </motion.button>
    </section>
  );
}
