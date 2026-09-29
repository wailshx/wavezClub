import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ShieldAlert } from "lucide-react";

import { CampaignSubmissions } from "@/components/admin-submissions";
import { listRegistrationCampaigns } from "@/lib/admin-registrations-api";

/**
 * Submissions for one campaign, on a page of their own.
 *
 * The announcement list used to expand the inbox inline, which meant the table
 * rendered inside a card that was already several cards deep. Reviewing who
 * applied is a job you sit down and do, so it gets its own route and its own
 * full-width table. The route opts out of nesting under the admin console with
 * the `admin_` segment, so this page owns its whole layout.
 */
export const Route = createFileRoute("/_authenticated/gestion/admin_/submissions/$campaignId")({
  component: CampaignSubmissionsPage,
});

function CampaignSubmissionsPage() {
  const { campaignId } = Route.useParams();

  // Same query the console uses, so the submission counts in the announcement
  // list and here cannot disagree. The server function itself enforces the
  // Submissions permission, so reaching this page is not the gate.
  const {
    data: campaigns,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listRegistrationCampaigns(),
  });

  const campaign = campaigns?.find((item) => item.id === campaignId);

  return (
    <div className="admin-theme min-h-screen">
      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8">
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/gestion/admin"
            search={{ tab: "events" }}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#94a3c8] transition-colors hover:text-white"
          >
            <ChevronLeft className="size-4" />
            Announcements
          </Link>
        </nav>

        <div className="admin-glass rounded-3xl p-6 md:p-8">
          {isLoading ? (
            <p className="py-10 text-center font-semibold text-[#94a3c8]">Loading submissions…</p>
          ) : error ? (
            <div className="py-10 text-center">
              <ShieldAlert className="mx-auto size-8 text-[#fcd34d]" />
              <h1 className="mt-3 font-display text-xl font-bold text-white">
                You don&apos;t have access to submissions
              </h1>
              <p className="mx-auto mt-2 max-w-md font-semibold text-[#94a3c8]">
                {(error as Error).message} Ask the club owner to grant you the Submissions section
                in the Admins page.
              </p>
            </div>
          ) : !campaign ? (
            <div className="py-10 text-center">
              <h1 className="font-display text-xl font-bold text-white">Announcement not found</h1>
              <p className="mt-2 font-semibold text-[#94a3c8]">
                This announcement no longer has an application form, or it was deleted. Students who
                already applied are not affected.
              </p>
            </div>
          ) : (
            <CampaignSubmissions campaign={campaign} inline={false} />
          )}
        </div>
      </main>
    </div>
  );
}
