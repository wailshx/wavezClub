import { useId } from "react";

const PULSE_PATH = "M36 164 L36 96 L128 96 L128 56 L220 56";

const PADS: Array<[number, number]> = [
  [36, 164],
  [220, 56],
  [128, 96],
  [128, 56],
];

export function PcbBackground() {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-20"
    >
      <defs>
        <pattern id={id} width={160} height={160} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#2563EB" strokeWidth={1}>
            <path d="M0 128 H72 V80 H160" />
            <path d="M24 160 V96 H96" />
            <path d="M0 40 H56 V24" />
            <path d="M160 8 H120 V56" />
          </g>
          {[
            [72, 80],
            [56, 24],
            [96, 96],
            [120, 56],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={3} fill="#2563EB" />
          ))}
          <rect x={132} y={32} width={6} height={6} rx={1} fill="#06B6D4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function HeroPulse() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-10 right-10 z-0 hidden h-48 w-64 xl:block"
    >
      <svg
        viewBox="0 0 256 192"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={PULSE_PATH}
          fill="none"
          stroke="#2563EB"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {PADS.map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={3.5}
            fill="none"
            stroke="#2563EB"
            strokeOpacity={0.45}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {PADS.map(([cx, cy]) => (
          <circle
            key={`pad-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={1.3}
            fill="#2563EB"
            fillOpacity={0.5}
          />
        ))}
      </svg>
      <svg
        viewBox="0 0 256 192"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={PULSE_PATH}
          pathLength={100}
          fill="none"
          stroke="#06B6D4"
          strokeWidth={1.25}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="pulse-trail-faint"
        />
        <path
          d={PULSE_PATH}
          pathLength={100}
          fill="none"
          stroke="#2563EB"
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="pulse-trail-mid"
        />
        <path
          d={PULSE_PATH}
          pathLength={100}
          fill="none"
          stroke="#9beeff"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="pulse-trail-head"
        />
      </svg>
      <div className="pulse-dot" />
    </div>
  );
}

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
