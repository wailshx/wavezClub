import { useId } from "react";

export function BoltDivider() {
  const id = useId();
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-4 py-10 opacity-80">
      <span className="h-px w-16 bg-linear-to-r from-transparent to-brand/40 md:w-40" />
      <svg viewBox="0 0 40 52" className="animate-bolt-flicker h-8 w-6 shrink-0">
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <polyline
          points="24,2 9,27 21,27 16,50 32,23 20,23 20,23"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="120"
          className="animate-bolt-draw"
        />
      </svg>
      <span className="h-px w-16 bg-linear-to-r from-brand/40 to-transparent md:w-40" />
    </div>
  );
}
