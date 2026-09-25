import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { leaderInitials, type ClubLeader } from "@/lib/leaders";

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
          <div className="grid h-full w-full place-items-center bg-brand/10 font-display text-5xl font-bold text-brand">
            {leaderInitials(leader.name)}
          </div>
        )}
      </div>
      <p className="mt-6 max-w-full truncate font-display text-2xl font-bold">{leader.name}</p>
      <p className="mt-1.5 max-w-full truncate text-[13px] font-extrabold tracking-wide text-brand uppercase">
        {leader.position}
      </p>
      {leader.description && (
        <p className="mt-3 line-clamp-3 text-[15px] leading-snug font-semibold text-muted-foreground">
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
  const reduced = useReducedMotion();
  // Pause-on-touch: pressing the marquee (mouse or finger) stops the scroll so
  // cards stay readable; it resumes shortly after the press ends. A vertical
  // page swipe over the strip only pauses it — the resume timer handles that.
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<number | null>(null);

  const pause = () => {
    setPaused(true);
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  };

  const scheduleResume = () => {
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      setPaused(false);
      resumeTimer.current = null;
    }, 3500);
  };

  if (reduced) {
    return (
      <div className="leaders-static">
        {leaders.map((leader) => (
          <LeaderCard key={leader.id} leader={leader} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`leaders-marquee${paused ? " is-paused" : ""}`}
      role="region"
      aria-label="Club leadership"
      onPointerDown={pause}
      onPointerUp={scheduleResume}
      onPointerCancel={scheduleResume}
      onPointerLeave={scheduleResume}
    >
      <div className="leaders-rail">
        <div className="leaders-group">
          {leaders.map((leader) => (
            <LeaderCard key={leader.id} leader={leader} />
          ))}
        </div>
        <div className="leaders-group" aria-hidden="true">
          {leaders.map((leader) => (
            <LeaderCard key={`${leader.id}-duplicate`} leader={leader} />
          ))}
        </div>
      </div>
    </div>
  );
}
