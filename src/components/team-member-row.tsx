import { useLayoutEffect, useRef, useState } from "react";
import { Linkedin } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { leaderInitials } from "@/lib/leaders";
import type { ClubTeamMember } from "@/lib/team";

/**
 * One public row in the "Mentors & community" grid. The avatar is a fixed 96px
 * square on the left, the text column sits beside it, and the bio is clamped to
 * three lines. When a bio is actually clamped a "Read more" button opens a
 * dialog with the full photo, name, role, bio and LinkedIn link — reading on
 * happens in a portal, so opening it never shifts the grid below.
 *
 * Reused by the admin console as the live row preview next to the editor.
 */
export function TeamMemberRow({
  member,
  className,
}: {
  member: ClubTeamMember;
  className?: string;
}) {
  const bioRef = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(false);
  const [open, setOpen] = useState(false);

  // Measured synchronously on (before paint) so the "Read more" button is
  // present from the first frame — a button that pops in after paint would
  // push the rows below it down.
  useLayoutEffect(() => {
    const el = bioRef.current;
    if (!el) {
      setClamped(false);
      return;
    }
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [member.bio]);

  return (
    <div className={`flex min-w-0 items-start gap-5 ${className ?? ""}`}>
      <div className="h-24 w-24 flex-none">
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

      <div className="min-w-0 flex-1">
        <h4 className="font-display text-lg font-bold text-foreground break-words">
          {member.name}
        </h4>
        <p className="mt-0.5 font-extrabold text-brand break-words">{member.role_title}</p>

        {member.bio && (
          <>
            <p
              ref={bioRef}
              className="mt-2 line-clamp-3 text-sm leading-relaxed font-semibold text-muted-foreground break-words whitespace-pre-line text-pretty"
            >
              {member.bio}
            </p>
            {clamped && (
              <Dialog open={open} onOpenChange={setOpen}>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-expanded={open}
                  className="mt-2 inline-block text-sm font-extrabold text-brand underline underline-offset-4 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Read more
                </button>
                <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-[1.25rem]">
                  <div className="relative aspect-[4/3] w-full bg-brand/10">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-brand/10 font-display text-5xl font-bold text-brand">
                        {leaderInitials(member.name)}
                      </div>
                    )}
                  </div>
                  <div className="p-6 md:p-8">
                    <DialogTitle className="text-xl font-bold md:text-2xl">
                      {member.name}
                    </DialogTitle>
                    <p className="mt-1.5 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">
                      {member.role_title}
                    </p>
                    <DialogDescription
                      asChild
                      className="mt-4 text-sm leading-relaxed font-semibold whitespace-pre-line text-pretty"
                    >
                      <p>{member.bio}</p>
                    </DialogDescription>
                    {member.linkedin_url && (
                      <a
                        href={member.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand/25 px-4 py-2 text-sm font-extrabold text-brand transition-colors hover:bg-brand/10"
                      >
                        <Linkedin className="size-4" />
                        View on LinkedIn
                      </a>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}

        {member.linkedin_url && (
          <div className="mt-4">
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
    </div>
  );
}
