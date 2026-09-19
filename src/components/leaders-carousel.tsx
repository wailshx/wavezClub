import { useReducedMotion } from "framer-motion";

import { leaderInitials, type ClubLeader } from "@/lib/leaders";

function LeaderCard({ leader }: { leader: ClubLeader }) {
  return (
    <article className="leader-card">
      <div className="relative h-44 overflow-hidden rounded-[1.15rem] bg-mint/20">
        {leader.image_url ? (
          <img
            src={leader.image_url}
            alt={leader.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-brand/10 font-display text-4xl font-bold text-brand">
            {leaderInitials(leader.name)}
          </div>
        )}
      </div>
      <p className="mt-3 truncate font-display text-lg font-bold">{leader.name}</p>
      <p className="mt-0.5 truncate text-xs font-extrabold tracking-wide text-brand uppercase">
        {leader.position}
      </p>
      {leader.description && (
        <p className="mt-2 line-clamp-3 text-sm leading-snug font-semibold text-muted-foreground">
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
    <div className="leaders-marquee" role="region" aria-label="Club leadership">
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
