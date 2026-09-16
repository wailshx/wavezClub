import type { ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";

const CORNERS: Array<{ pos: string; delay: string }> = [
  { pos: "tl", delay: "0ms" },
  { pos: "tr", delay: "60ms" },
  { pos: "bl", delay: "120ms" },
  { pos: "br", delay: "180ms" },
];

export function CircuitCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className={`relative ${className} ${inView ? "circuit-on" : ""}`}>
      {CORNERS.map(({ pos, delay }) => (
        <span
          key={pos}
          aria-hidden="true"
          style={{ transitionDelay: delay }}
          className={`circuit-corner circuit-corner-${pos}`}
        />
      ))}
      {children}
    </div>
  );
}
