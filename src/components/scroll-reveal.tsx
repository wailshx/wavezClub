import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type ScrollRevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** Stagger offset in seconds (e.g. 0.1, 0.15). */
  delay?: number;
};

export function ScrollReveal({ children, delay = 0, className, ...rest }: ScrollRevealProps) {
  const reduced = useReducedMotion();
  const revealProps = reduced
    ? {
        initial: false as const,
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 30 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: "easeOut" as const, delay },
      };

  return (
    <motion.div
      className={className}
      viewport={{ once: true, amount: 0.2 }}
      {...revealProps}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
