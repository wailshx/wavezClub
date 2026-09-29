import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useReducedMotion } from "framer-motion";

import { leaderInitials, type ClubLeader } from "@/lib/leaders";

/** Auto-advance interval, and how long the carousel stays paused after a touch. */
const AUTOPLAY_MS = 4500;
const RESUME_AFTER_MS = 4000;

function LeaderCard({ leader }: { leader: ClubLeader }) {
  return (
    <article className="leader-unit">
      <div className="leader-photo">
        {leader.image_url ? (
          <img
            src={leader.image_url}
            alt={leader.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-brand/10 font-display text-6xl font-bold text-brand">
            {leaderInitials(leader.name)}
          </div>
        )}
      </div>
      <p className="mt-7 max-w-full truncate font-display text-3xl font-bold tracking-tight">
        {leader.name}
      </p>
      <p className="mt-2 max-w-full truncate text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
        {leader.position}
      </p>
      {leader.description && (
        <p className="mt-4 line-clamp-3 max-w-xs text-[15px] leading-relaxed font-semibold text-muted-foreground">
          {leader.description}
        </p>
      )}
    </article>
  );
}

type LeadersCarouselProps = {
  leaders: ClubLeader[];
};

export function LeadersCarousel({ leaders }: LeadersCarouselProps) {
  // Reduced motion keeps the carousel and its controls, and only drops the
  // automatic movement. A visitor who asked for less motion can still browse
  // every officer by hand.
  const reduced = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    containScroll: "trimSnaps",
  });
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [paused, setPaused] = useState(false);

  const onSelect = useCallback((api: NonNullable<typeof emblaApi>) => {
    setSelected(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    setSnapCount(emblaApi.scrollSnapList().length);
    onSelect(emblaApi);
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Auto-advance, with a pause after any interaction. Dragging a carousel that
  // keeps yanking itself out from under your finger feels broken, so the timer
  // only restarts once the visitor has stopped interacting for a moment.
  useEffect(() => {
    if (reduced || paused || snapCount < 2) return;
    const timer = window.setInterval(() => {
      if (emblaApi?.canScrollNext()) emblaApi.scrollNext();
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [emblaApi, reduced, paused, snapCount]);

  const pauseTemporarily = useCallback(() => {
    setPaused(true);
  }, []);

  useEffect(() => {
    if (!paused) return;
    const timer = window.setTimeout(() => setPaused(false), RESUME_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [paused]);

  if (leaders.length === 0) return null;

  return (
    <div
      className="leaders-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Club leadership"
    >
      <div
        className="leaders-viewport"
        ref={emblaRef}
        onPointerDown={pauseTemporarily}
        onFocusCapture={pauseTemporarily}
      >
        <div className="leaders-track">
          {leaders.map((leader, index) => (
            <div
              key={leader.id}
              className="leaders-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${leaders.length}: ${leader.name}`}
            >
              <LeaderCard leader={leader} />
            </div>
          ))}
        </div>
      </div>

      {snapCount > 1 && (
        <div className="leaders-dots">
          {Array.from({ length: snapCount }, (_, index) => (
            <button
              key={index}
              type="button"
              // A moving highlight bar is the clearest position cue at this
              // size, and it doubles as the autoplay timer.
              className="leaders-dot"
              data-active={index === selected || undefined}
              onClick={() => {
                pauseTemporarily();
                emblaApi?.scrollTo(index);
              }}
              aria-label={`Go to leader ${index + 1}`}
              aria-current={index === selected || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
