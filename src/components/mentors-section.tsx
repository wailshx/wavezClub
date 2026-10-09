import { ScrollReveal } from "@/components/scroll-reveal";
import { TeamMemberRow } from "@/components/team-member-row";
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
        <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {members.map((member) => (
            <li key={member.id} className="min-w-0">
              <TeamMemberRow member={member} />
            </li>
          ))}
        </ul>
      </ScrollReveal>
    </section>
  );
}
