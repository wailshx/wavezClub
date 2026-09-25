import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type ScrollRevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** Stagger offset in seconds (e.g. 0.1, 0.15). */
  delay?: number;
  /** Calm pop-in: unit starts slightly scaled down and settles (no overshoot). */
  scale?: boolean;
  /** Vertical travel of the reveal in px. Default 30. */
  from?: number;
  /** Fade during the reveal. false = transform-only slide (no double-fade). */
  fade?: boolean;
  /** Reveal duration in seconds. Defaults: pop 0.3, slide 0.6. */
  duration?: number;
};

export function ScrollReveal({
  children,
  delay = 0,
  scale = false,
  from = 30,
  fade = true,
  duration,
  className,
  ...rest
}: ScrollRevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <motion.div
        className={className}
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0 }}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ y: from, ...(scale ? { scale: 0.96 } : {}), ...(fade ? { opacity: 0 } : {}) }}
      whileInView={{ y: 0, ...(scale ? { scale: 1 } : {}), ...(fade ? { opacity: 1 } : {}) }}
      transition={{
        duration: duration ?? (scale ? 0.3 : 0.6),
        ease: scale ? [0.16, 1, 0.3, 1] : "easeOut",
        delay,
      }}
      viewport={{ once: true, amount: 0.2 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
