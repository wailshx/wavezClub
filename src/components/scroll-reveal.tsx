import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

type ScrollRevealProps = HTMLAttributes<HTMLDivElement> & {
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

/**
 * Scroll-triggered fade/slide, done with CSS transitions + one
 * IntersectionObserver instead of framer-motion. The public pages used to ship
 * ~125 KB of animation runtime for this; the only thing it still needs from the
 * platform is `prefers-reduced-motion`, which the tiny hook beside this file
 * covers.
 *
 * Elements start hidden and `data-reveal-state="visible"` triggers the same
 * transition the old `whileInView` did (`once`, `amount: 0.2`).
 */
export function ScrollReveal({
  children,
  delay = 0,
  scale = false,
  from = 30,
  fade = true,
  duration,
  className,
  style,
  ...rest
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced || typeof IntersectionObserver === "undefined") {
      node.dataset["revealState"] = "visible";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        node.dataset["revealState"] = "visible";
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={
        fade ? `reveal ${className ?? ""}` : `reveal reveal--transform-only ${className ?? ""}`
      }
      style={
        {
          "--reveal-from": `${from}px`,
          "--reveal-scale": scale ? 0.96 : 1,
          "--reveal-delay": `${delay}s`,
          "--reveal-duration": `${duration ?? (scale ? 0.3 : 0.6)}s`,
          "--reveal-ease": scale ? "cubic-bezier(0.16, 1, 0.3, 1)" : "ease-out",
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </div>
  );
}
