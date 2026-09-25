import { Linkedin } from "lucide-react";

import { ScrollReveal } from "@/components/scroll-reveal";
import { leaderInitials } from "@/lib/leaders";
import type { ClubTeamMember } from "@/lib/team";

type MentorsSectionProps = {
  members: ClubTeamMember[];
};

export function MentorsSection({ members }: MentorsSectionProps) {
  if (members.length === 0) return null;

  return (
    <section id="mentors" className="mx-auto max-w-6xl px-5 pt-12 pb-16">
      <ScrollReveal>
        <h2 className="font-display text-3xl font-bold md:text-4xl">Our Mentors &amp; Community</h2>
      </ScrollReveal>
      <ScrollReveal delay={0.1}>
        <p className="mt-2 max-w-3xl font-semibold text-muted-foreground">
          The faculty, club officers and standout students who guide Wavez Club.
        </p>
      </ScrollReveal>
      <ScrollReveal delay={0.15}>
        <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-5">
              <div className="h-28 w-28 flex-none">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.name}
                    loading="lazy"
                    className="h-full w-full rounded-full object-cover shadow-[0_16px_36px_-16px_rgba(37,99,235,0.5)] ring-1 ring-brand/15"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center rounded-full bg-brand/10 font-display text-2xl font-bold text-brand shadow-[0_16px_36px_-16px_rgba(37,99,235,0.45)] ring-1 ring-brand/15">
                    {leaderInitials(member.name)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-display text-lg font-bold">{member.name}</h4>
                <p className="mt-0.5 text-brand">{member.role_title}</p>
                {member.linkedin_url && (
                  <div className="mt-3">
                    <a
                      href={member.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.name} on LinkedIn`}
                      className="inline-flex rounded-full p-1 text-brand transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <Linkedin className="size-5" />
                    </a>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </ScrollReveal>
    </section>
  );
}
