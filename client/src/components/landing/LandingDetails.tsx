import { motion, useReducedMotion } from "framer-motion";
import type { LandingConfig } from "@/lib/landingConfigs";
import { staggerContainer, staggerItem } from "./primitives";

/** Короткие ответы на вопросы «сколько это длится, сколько стоит, кого можно взять». */
export function LandingDetails({ config }: { config: LandingConfig }) {
  const reduce = useReducedMotion();

  return (
    <section className="relative" style={{ backgroundColor: "var(--paper-deep)" }}>
      <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:py-20 lg:px-10">
        <motion.dl
          className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-4"
          style={{ backgroundColor: "var(--ink-faint)" }}
          variants={staggerContainer}
          initial={reduce ? undefined : "hidden"}
          whileInView={reduce ? undefined : "visible"}
          viewport={{ once: true, margin: "-60px" }}
        >
          {config.details.map((tile) => (
            <motion.div
              key={tile.label}
              variants={staggerItem}
              className="px-4 py-5 sm:px-6 sm:py-8"
              style={{ backgroundColor: "var(--paper)" }}
            >
              <dt className="landing-eyebrow">{tile.label}</dt>
              <dd className="landing-display mt-2 text-2xl sm:mt-3 sm:text-4xl" style={{ color: "var(--shu)" }}>
                {tile.value}
              </dd>
              {tile.hint && (
                <p className="mt-1 text-xs sm:mt-2 sm:text-sm" style={{ color: "var(--ink-soft)" }}>
                  {tile.hint}
                </p>
              )}
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
