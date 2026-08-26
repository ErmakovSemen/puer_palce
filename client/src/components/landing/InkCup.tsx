import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Цвет настоя от первого пролива к последнему — та же шкала, что в разделе о ритуале. */
const POURS = ["#E8C979", "#D9A24A", "#C58436", "#B9702C", "#9E5324", "#7A3B22", "#5E2A14"];

/**
 * Гайвань, нарисованная линией, вместо фотографии в шапке:
 * ensō на фоне, пар над пиалой и шкала проливов внизу.
 */
export function InkCup() {
  const reduce = useReducedMotion();

  const draw = (delay: number, duration = 1.4) => ({
    initial: reduce ? undefined : { pathLength: 0, opacity: 0 },
    animate: reduce ? undefined : { pathLength: 1, opacity: 1 },
    transition: { duration, delay, ease: EASE },
  });

  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      <svg viewBox="0 0 400 470" className="w-full" role="img" aria-label="Гайвань, над которой поднимается пар">
        {/* Круг тушью — фон композиции */}
        <motion.circle
          cx="200"
          cy="250"
          r="150"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="880 60"
          opacity="0.5"
          {...draw(0.2, 2)}
        />

        {/* Пар */}
        <g fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" opacity="0.55">
          {[
            { d: "M170 150 C 156 122, 186 106, 172 78 S 186 40, 176 22", delay: 1.0 },
            { d: "M200 142 C 186 112, 216 96, 202 66 S 216 32, 206 12", delay: 1.15 },
            { d: "M230 152 C 216 124, 246 108, 232 80 S 246 44, 236 26", delay: 1.3 },
          ].map((steam, index) => (
            <motion.path
              key={steam.d}
              d={steam.d}
              {...draw(steam.delay, 1.6)}
              style={
                reduce
                  ? undefined
                  : {
                      animation: `landing-steam 5.${index}s ease-in-out ${1.8 + index * 0.4}s infinite`,
                      transformOrigin: "center bottom",
                    }
              }
            />
          ))}
        </g>

        <g fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Крышка */}
          <motion.path d="M126 206 C 150 176, 250 176, 274 206" {...draw(0.5)} />
          <motion.path d="M126 206 L 274 206" {...draw(0.62, 0.8)} />
          <motion.path d="M200 176 L 200 166" {...draw(0.72, 0.5)} />
          <motion.circle cx="200" cy="162" r="7" {...draw(0.78, 0.6)} />

          {/* Чаша */}
          <motion.path d="M132 222 L 268 222" {...draw(0.66, 0.8)} />
          <motion.path d="M138 224 C 148 288, 176 322, 200 322 C 224 322, 252 288, 262 224" {...draw(0.8, 1.2)} />

          {/* Блюдце */}
          <motion.path d="M118 344 C 150 366, 250 366, 282 344" {...draw(1.0, 1)} />
          <motion.path d="M118 344 C 150 328, 250 328, 282 344" {...draw(1.08, 1)} />
        </g>

        {/* Шкала проливов */}
        <g>
          {POURS.map((color, index) => (
            <motion.circle
              key={color}
              cx={104 + index * 32}
              cy="418"
              r="9"
              fill={color}
              initial={reduce ? undefined : { opacity: 0, y: 8 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.4 + index * 0.09, ease: EASE }}
            />
          ))}
        </g>
        <motion.text
          x="200"
          y="452"
          textAnchor="middle"
          fill="var(--ink-soft)"
          style={{ fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}
          initial={reduce ? undefined : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.1 }}
        >
          семь проливов
        </motion.text>
      </svg>
    </div>
  );
}
