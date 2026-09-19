import { Linkedin } from "lucide-react";

import { leaderInitials } from "@/lib/leaders";
import type { ClubTeamMember } from "@/lib/team";

type MentorsSectionProps = {
  members: ClubTeamMember[];
};

export function MentorsSection({ members }: MentorsSectionProps) {
  if (members.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <h2 className="font-display text-3xl font-bold">Our Mentors &amp; Community</h2>
      <p className="mt-2 max-w-3xl font-semibold text-muted-foreground">
        The faculty, club officers and standout students who guide Wavez Club.
      </p>
      <ul className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-4">
            <div className="h-24 w-24 flex-none">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  loading="lazy"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center rounded-full bg-[#2e6bff]/10 font-display text-2xl font-bold text-[#2e6bff]">
                  {leaderInitials(member.name)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold">{member.name}</h4>
              <p className="mt-0.5 text-[#2e6bff]">{member.role_title}</p>
              {member.linkedin_url && (
                <div className="mt-3">
                  <a
                    href={member.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${member.name} on LinkedIn`}
                    className="inline-flex rounded-full p-1 text-[#2e6bff] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#2e6bff] focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Linkedin className="size-5" />
                  </a>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
