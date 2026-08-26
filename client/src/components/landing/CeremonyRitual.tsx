import { motion, useReducedMotion } from "framer-motion";
import type { LandingConfig } from "@/lib/landingConfigs";
import { Reveal, SectionHeading, staggerContainer, staggerItem } from "./primitives";

/**
 * Ключевая секция лендинга: ход церемонии.
 * Кружок рядом с каждым действием — цвет настоя в пиале, он темнеет к поздним проливам.
 */
export function CeremonyRitual({ config }: { config: LandingConfig }) {
  const reduce = useReducedMotion();
  const ritual = config.ritual;
  if (!ritual) return null;

  return (
    <section id="ritual" className="relative mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:px-10">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={ritual.eyebrow} title={ritual.title} lead={ritual.lead} />

          <Reveal delay={0.15} className="mt-10">
            <div className="flex items-center gap-2" aria-hidden="true">
              {ritual.steps.map((step) => (
                <span
                  key={step.numeral}
                  className="h-2 flex-1 rounded-full"
                  style={{ backgroundColor: step.liquor }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--ink-soft)" }}>
              Цвет настоя от первого пролива к последнему
            </p>
          </Reveal>
        </div>

        <motion.ol
          className="relative"
          variants={staggerContainer}
          initial={reduce ? undefined : "hidden"}
          whileInView={reduce ? undefined : "visible"}
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Вертикальная нить, связывающая действия */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[1.4rem] top-6 w-px sm:left-[1.65rem]"
            style={{ background: "var(--ink-faint)" }}
          />

          {ritual.steps.map((step) => (
            <motion.li key={step.numeral} variants={staggerItem} className="relative flex gap-6 pb-12 last:pb-0 sm:gap-8">
              <div className="relative z-10 flex flex-col items-center">
                <motion.span
                  className="flex h-[2.8rem] w-[2.8rem] shrink-0 items-center justify-center rounded-full sm:h-[3.3rem] sm:w-[3.3rem]"
                  style={{ backgroundColor: step.liquor, boxShadow: "inset 0 -6px 14px rgba(0,0,0,0.18)" }}
                  whileHover={reduce ? undefined : { scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                >
                  <span className="landing-han text-lg text-[rgba(255,255,255,0.92)] sm:text-xl">{step.numeral}</span>
                </motion.span>
              </div>

              <div className="pt-1">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="landing-display text-2xl sm:text-3xl">{step.title}</h3>
                  <span className="landing-eyebrow">{step.duration}</span>
                </div>
                <p className="mt-3 max-w-xl leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {step.text}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
