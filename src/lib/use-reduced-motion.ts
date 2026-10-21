import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

/** The server has no media queries — render the un-reduced variant, then hydrate. */
function getServerSnapshot() {
  return false;
}

/**
 * `prefers-reduced-motion` without pulling framer-motion into the public
 * bundle. Kept in sync across tab visibility changes by the browser's own
 * media-query listener.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
