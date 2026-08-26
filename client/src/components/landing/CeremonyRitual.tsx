import { motion, useReducedMotion } from "framer-motion";
import type { LandingConfig } from "@/lib/landingConfigs";
import { SectionHeading, staggerContainer, staggerItem } from "./primitives";

/** Короткие конверсионные триггеры вместо подробного сценария церемонии. */
export function CeremonyRitual({ config }: { config: LandingConfig }) {
  const reduce = useReducedMotion();
  const ritual = config.ritual;
  if (!ritual) return null;

  return (
    <section id="ritual" className="relative mx-auto w-full max-w-7xl px-6 py-14 sm:py-24 lg:px-10">
      <div className="grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
        <SectionHeading eyebrow={ritual.eyebrow} title={ritual.title} lead={ritual.lead} />

        <motion.div
          className="landing-feature-carousel -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0"
          role="list"
          aria-label="Особенности церемонии"
          variants={staggerContainer}
          initial={reduce ? undefined : "hidden"}
          whileInView={reduce ? undefined : "visible"}
          viewport={{ once: true, margin: "-100px" }}
        >
          {ritual.steps.map((step) => (
            <motion.article
              key={step.title}
              role="listitem"
              variants={staggerItem}
              className="min-w-[82vw] snap-start rounded-2xl border p-4 sm:min-w-0 sm:p-6"
              style={{ borderColor: "var(--ink-faint)", backgroundColor: "var(--paper-card)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="landing-display text-xl sm:text-2xl">{step.title}</h3>
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: step.liquor, color: "white" }}>
                  {step.duration}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {step.text}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
