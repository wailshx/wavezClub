/**
 * Small "live / open / happening-soon" status dot with a soft breathing ring.
 * The ring is pure CSS (`@keyframes pulse-dot-ring`) and is collapsed to a
 * static dot by the site-wide prefers-reduced-motion rule.
 *
 * `tone="inverse"` flips the fill to the page background so the dot stays legible
 * on a solid dark chip.
 */
export function PulseDot({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "inverse";
}) {
  const dot = tone === "inverse" ? "bg-background" : "bg-brand";
  const ring = tone === "inverse" ? "bg-background/40" : "bg-brand/40";
  return (
    <span className={`relative inline-flex size-2 flex-none ${className ?? ""}`} aria-hidden="true">
      <span className={`pulse-dot-ring absolute inset-0 rounded-full ${ring}`} />
      <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
    </span>
  );
}
