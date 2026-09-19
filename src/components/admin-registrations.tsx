import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FilePlus2,
  Inbox,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  UserCheck,
  X,
} from "lucide-react";

import {
  acceptRegistration,
  deleteRegistrationCampaign,
  getRegistrationDocumentUrl,
  listCampaignRegistrations,
  listRegistrationCampaigns,
  removeRegistration,
  saveRegistrationCampaign,
  setCampaignOpen,
  toggleRegistrationCheckIn,
  type AdminCampaign,
  type AdminRegistration,
  type RegistrationDocumentKey,
  type SaveCampaignInput,
} from "@/lib/admin-registrations-api";
import type { CampaignKind, CampaignQuestion, CampaignQuestionType } from "@/lib/registrations";
import { initials } from "@/lib/club";

type CampaignDraft = {
  id: string | null;
  title: string;
  description: string;
  is_open: boolean;
  kind: CampaignKind;
  display_order: number;
  custom_questions: CampaignQuestion[];
};

const fieldClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand";

function blankDraft(campaign: AdminCampaign | null): CampaignDraft {
  return {
    id: campaign?.id ?? null,
    title: campaign?.title ?? "",
    description: campaign?.description ?? "",
    is_open: campaign?.is_open ?? false,
    kind: campaign?.kind ?? "membership",
    display_order: campaign?.display_order ?? 0,
    custom_questions: (campaign?.custom_questions ?? []).map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      options: question.type === "choice" ? (question.options ?? []) : [],
    })),
  };
}

function newQuestion(): CampaignQuestion {
  return { id: crypto.randomUUID(), label: "", type: "text", options: [] };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminRegistrations() {
  const queryClient = useQueryClient();
  const [activeCampaign, setActiveCampaign] = useState<AdminCampaign | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCampaign | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<AdminRegistration | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminRegistration | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listRegistrationCampaigns(),
  });

  const { data: registrations = [], isLoading: registrationsLoading } = useQuery({
    queryKey: ["campaign-registrations", activeCampaign?.id],
    enabled: activeCampaign !== null,
    queryFn: () => listCampaignRegistrations({ data: activeCampaign!.id }),
  });

  const save = useMutation({
    mutationFn: (input: SaveCampaignInput) => saveRegistrationCampaign({ data: input }),
    onSuccess: () => {
      toast.success(draft?.id ? "Campaign updated" : "Campaign created");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not save the campaign"),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; is_open: boolean }) => setCampaignOpen({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not update the campaign"),
  });

  const removeCampaign = useMutation({
    mutationFn: (id: string) => deleteRegistrationCampaign({ data: id }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      setDeleteTarget(null);
      if (activeCampaign?.id === deleteTarget?.id) setActiveCampaign(null);
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not delete the campaign"),
  });

  const accept = useMutation({
    mutationFn: (id: string) => acceptRegistration({ data: id }),
    onSuccess: () => {
      toast.success(
        activeCampaign?.kind === "event"
          ? "Submission accepted — confirmed for the event"
          : "Submission accepted — member added",
      );
      setAcceptTarget(null);
      queryClient.invalidateQueries({
        queryKey: ["campaign-registrations", activeCampaign?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not accept the submission"),
  });

  const checkIn = useMutation({
    mutationFn: (input: { id: string; checked_in: boolean }) =>
      toggleRegistrationCheckIn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaign-registrations", activeCampaign?.id],
      });
    },
    onError: (error) => toast.error(error.message ?? "Could not update check-in"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeRegistration({ data: id }),
    onSuccess: () => {
      toast.success("Submission removed");
      setRemoveTarget(null);
      queryClient.invalidateQueries({
        queryKey: ["campaign-registrations", activeCampaign?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not remove the submission"),
  });

  function submitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const title = draft.title.trim();
    if (!title) {
      toast.error("Give the campaign a title");
      return;
    }

    const questions: CampaignQuestion[] = draft.custom_questions.map((question) => ({
      id: question.id,
      label: question.label.trim(),
      type: question.type,
      ...(question.type === "choice"
        ? { options: (question.options ?? []).map((option) => option.trim()).filter(Boolean) }
        : {}),
    }));

    if (questions.some((question) => !question.label)) {
      toast.error("Every question needs a label");
      return;
    }
    if (
      questions.some((question) => question.type === "choice" && !(question.options ?? []).length)
    ) {
      toast.error("Multiple-choice questions need at least one option");
      return;
    }

    save.mutate({
      id: draft.id ?? undefined,
      title,
      description: draft.description.trim(),
      is_open: draft.is_open,
      kind: draft.kind,
      display_order: draft.display_order,
      custom_questions: questions,
    });
  }

  function updateQuestion(index: number, patch: Partial<CampaignQuestion>) {
    if (!draft) return;
    setDraft({
      ...draft,
      custom_questions: draft.custom_questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    });
  }

  const modalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <div className="mt-6">
      {draft ? (
        <CampaignEditor
          draft={draft}
          setDraft={setDraft}
          onSubmit={submitDraft}
          saving={save.isPending}
          onCancel={() => setDraft(null)}
          updateQuestion={updateQuestion}
        />
      ) : activeCampaign ? (
        <RegistrationsView
          campaign={activeCampaign}
          registrations={registrations}
          isLoading={registrationsLoading}
          onBack={() => setActiveCampaign(null)}
          onAccept={(registration) => setAcceptTarget(registration)}
          onRemove={(registration) => setRemoveTarget(registration)}
          onCheckIn={(registration) =>
            checkIn.mutate({ id: registration.id, checked_in: !registration.checked_in })
          }
        />
      ) : (
        <CampaignsList
          campaigns={campaigns}
          isLoading={isLoading}
          onEdit={(campaign) => setDraft(blankDraft(campaign))}
          onNew={() => {
            const draft = blankDraft(null);
            draft.display_order = Math.max(...campaigns.map((c) => c.display_order), 0) + 1;
            setDraft(draft);
          }}
          onOpen={(campaign, is_open) => toggle.mutate({ id: campaign.id, is_open })}
          onDelete={(campaign) => setDeleteTarget(campaign)}
          onView={(campaign) => setActiveCampaign(campaign)}
        />
      )}

      {modalRoot &&
        (deleteTarget || acceptTarget || removeTarget) &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-5 py-10 backdrop-blur-sm"
            role="presentation"
          >
            <div className="admin-glass-strong w-full max-w-md overflow-y-auto rounded-3xl p-7">
              {deleteTarget && (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Delete campaign</h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    Deleting <span className="text-white">“{deleteTarget.title}”</span> is
                    permanent.
                    {deleteTarget.submission_count > 0 && (
                      <>
                        {" "}
                        <span className="text-[#fcd34d]">
                          It has {deleteTarget.submission_count} submission
                          {deleteTarget.submission_count === 1 ? "" : "s"} attached, which will be
                          deleted with it.
                        </span>
                      </>
                    )}
                  </p>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        removeCampaign.mutate(deleteTarget.id);
                      }}
                      disabled={removeCampaign.isPending}
                      className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                    >
                      {removeCampaign.isPending
                        ? "Deleting…"
                        : deleteTarget.submission_count > 0
                          ? "Delete anyway"
                          : "Delete campaign"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  {deleteTarget.submission_count > 0 && (
                    <button
                      onClick={() => {
                        setDeleteTarget(null);
                        toggle.mutate({ id: deleteTarget.id, is_open: false });
                        toast.info("Campaign closed instead of deleted");
                      }}
                      className="mt-3 w-full rounded-2xl border border-[#34d399]/30 bg-[#34d399]/10 px-6 py-3 text-sm font-bold text-[#6ee7b7] transition-colors hover:bg-[#34d399]/20"
                    >
                      Safer: close the campaign instead (keeps submissions)
                    </button>
                  )}
                </>
              )}

              {acceptTarget && (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Accept submission</h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    Accept{" "}
                    <span className="text-white">
                      {acceptTarget.first_name} {acceptTarget.last_name}
                    </span>{" "}
                    ({acceptTarget.email}) —{" "}
                    {activeCampaign?.kind === "event" ? (
                      <>
                        they are confirmed for the event.{" "}
                        <span className="text-white">They will not be added to Members.</span>
                      </>
                    ) : (
                      <>they will be added to Members as an active member.</>
                    )}
                  </p>
                  {!acceptTarget.checked_in && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2 text-xs font-bold text-[#fcd34d]">
                      <CalendarCheck className="mt-0.5 size-3.5 shrink-0" />
                      This student hasn't been checked in for interview yet.
                    </p>
                  )}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => accept.mutate(acceptTarget.id)}
                      disabled={accept.isPending}
                      className="clay-md inline-flex items-center gap-2 rounded-2xl bg-[#34d399] px-6 py-3 font-bold text-[#04121a] shadow-[0_14px_38px_-16px_rgba(52,211,153,0.6)] disabled:opacity-70"
                    >
                      <Check className="size-4" />
                      {accept.isPending
                        ? "Accepting…"
                        : activeCampaign?.kind === "event"
                          ? "Accept for event"
                          : "Accept & add to Members"}
                    </button>
                    <button
                      onClick={() => setAcceptTarget(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {removeTarget && (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Remove submission</h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    Remove{" "}
                    <span className="text-white">
                      {removeTarget.first_name} {removeTarget.last_name}
                    </span>{" "}
                    from this campaign. They will be marked as removed and{" "}
                    <span className="text-[#fcd34d]">won’t</span> be added to Members.
                  </p>
                  {!removeTarget.checked_in && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2 text-xs font-bold text-[#fcd34d]">
                      <CalendarCheck className="mt-0.5 size-3.5 shrink-0" />
                      This student hasn't been checked in for interview yet.
                    </p>
                  )}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => remove.mutate(removeTarget.id)}
                      disabled={remove.isPending}
                      className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                    >
                      {remove.isPending ? "Removing…" : "Remove submission"}
                    </button>
                    <button
                      onClick={() => setRemoveTarget(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          modalRoot,
        )}
    </div>
  );
}

// ─── Campaign list ───────────────────────────────────────────────────────────

function CampaignsList({
  campaigns,
  isLoading,
  onNew,
  onEdit,
  onOpen,
  onDelete,
  onView,
}: {
  campaigns: AdminCampaign[];
  isLoading: boolean;
  onNew: () => void;
  onEdit: (campaign: AdminCampaign) => void;
  onOpen: (campaign: AdminCampaign, is_open: boolean) => void;
  onDelete: (campaign: AdminCampaign) => void;
  onView: (campaign: AdminCampaign) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm font-semibold text-[#94a3c8]">
          Registration campaigns drive the open form on the public site. Open campaigns are shown as
          entry cards; you can run several at once.
        </p>
        <button
          onClick={onNew}
          className="clay-sm flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-14px_rgba(46,107,255,0.55)]"
        >
          <FilePlus2 className="size-4" />
          New campaign
        </button>
      </div>

      {isLoading ? (
        <p className="mt-8 text-center font-semibold text-[#94a3c8]">Loading…</p>
      ) : campaigns.length === 0 ? (
        <p className="admin-glass mt-8 rounded-2xl px-4 py-10 text-center font-semibold text-[#94a3c8]">
          No campaigns yet — create your first one to start collecting registrations.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-left text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Submissions</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="transition-colors hover:bg-white/[0.04]">
                  <td className="px-5 py-3.5">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-white">
                      {campaign.title}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                          campaign.kind === "event"
                            ? "border-[#34d399]/40 bg-[#34d399]/15 text-[#6ee7b7]"
                            : "border-[#2e6bff]/40 bg-[#2e6bff]/15 text-[#6fa0ff]"
                        }`}
                      >
                        {campaign.kind === "event" ? "Event" : "New members"}
                      </span>
                    </p>
                    <p className="text-xs text-[#94a3c8]">
                      {campaign.description || "No description"} · created{" "}
                      {formatDate(campaign.created_at)}
                      {campaign.custom_questions.length > 0 &&
                        ` · ${campaign.custom_questions.length} custom question${
                          campaign.custom_questions.length === 1 ? "" : "s"
                        }`}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      role="switch"
                      aria-checked={campaign.is_open}
                      onClick={() => onOpen(campaign, !campaign.is_open)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase transition-colors ${
                        campaign.is_open
                          ? "border-[#34d399]/40 bg-[#34d399]/15 text-[#6ee7b7] hover:bg-[#34d399]/25"
                          : "border-white/10 bg-white/5 text-[#94a3c8] hover:text-white"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          campaign.is_open ? "bg-[#34d399]" : "bg-[#94a3c8]"
                        }`}
                      />
                      {campaign.is_open ? "Open" : "Closed"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2e6bff]/15 px-2.5 py-1 text-xs font-extrabold text-[#6fa0ff]">
                      <Inbox className="size-3.5" />
                      {campaign.submission_count}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => onView(campaign)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/20 px-3 py-2 text-xs font-bold text-[#6fa0ff] transition-colors hover:bg-[#2e6bff]/30"
                      >
                        <Inbox className="size-3.5" />
                        Submissions
                      </button>
                      <button
                        onClick={() => onEdit(campaign)}
                        aria-label={`Edit ${campaign.title}`}
                        className="rounded-lg bg-[#34d399]/20 p-2 text-[#6ee7b7] transition-colors hover:bg-[#34d399]/30"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => onDelete(campaign)}
                        aria-label={`Delete ${campaign.title}`}
                        className="rounded-lg bg-[#f43f5e]/20 p-2 text-[#fda4af] transition-colors hover:bg-[#f43f5e]/30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Campaign editor ─────────────────────────────────────────────────────────

function CampaignEditor({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  saving,
  updateQuestion,
}: {
  draft: CampaignDraft;
  setDraft: (draft: CampaignDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  saving: boolean;
  updateQuestion: (index: number, patch: Partial<CampaignQuestion>) => void;
}) {
  const setQuestionOption = (index: number, optionIndex: number, value: string) => {
    const question = draft.custom_questions[index];
    if (!question) return;
    const options = (question.options ?? []).map((option, i) =>
      i === optionIndex ? value : option,
    );
    updateQuestion(index, { options });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            {draft.id ? "Edit campaign" : "New campaign"}
          </h2>
          <p className="text-sm font-semibold text-[#94a3c8]">
            {draft.id
              ? "Update the campaign details and questions."
              : "Set up a registration drive."}
          </p>
        </div>
        <span className="rounded-full border border-[#2e6bff]/40 bg-[#2e6bff]/15 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-[#6fa0ff] uppercase">
          Registrations
        </span>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-extrabold text-muted-foreground uppercase">
            Title <span className="text-[#fda4af]">*</span>
          </label>
          <input
            required
            maxLength={120}
            className={fieldClass}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Hackathon 2026"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-extrabold text-muted-foreground uppercase">
            Short description shown on the public card
          </label>
          <textarea
            rows={2}
            maxLength={300}
            className={fieldClass}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Join us for a 48-hour build sprint — teams, mentors and prizes."
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, is_open: !draft.is_open })}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors sm:col-span-2 ${
              draft.is_open
                ? "border-[#34d399]/40 bg-[#34d399]/10 text-[#6ee7b7]"
                : "border-white/10 bg-black/20 text-[#94a3c8]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${draft.is_open ? "bg-[#34d399]" : "bg-[#94a3c8]"}`}
              />
              {draft.is_open
                ? "Open — this campaign is visible on the public site"
                : "Closed — hidden from the public site"}
            </span>
            <span className="text-xs font-extrabold uppercase">
              {draft.is_open ? "Open" : "Closed"}
            </span>
          </button>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-extrabold text-muted-foreground uppercase">
            What accepting does
          </label>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, kind: "membership" })}
              aria-pressed={draft.kind === "membership"}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                draft.kind === "membership"
                  ? "border-[#2e6bff]/50 bg-[#2e6bff]/15"
                  : "border-white/10 bg-black/20 hover:bg-white/5"
              }`}
            >
              <p
                className={`text-sm font-bold ${draft.kind === "membership" ? "text-[#6fa0ff]" : "text-white"}`}
              >
                New members drive
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                Accepted applicants become club members (added to Members).
              </p>
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, kind: "event" })}
              aria-pressed={draft.kind === "event"}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                draft.kind === "event"
                  ? "border-[#34d399]/50 bg-[#34d399]/10"
                  : "border-white/10 bg-black/20 hover:bg-white/5"
              }`}
            >
              <p
                className={`text-sm font-bold ${draft.kind === "event" ? "text-[#6ee7b7]" : "text-white"}`}
              >
                Event sign-up
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                Participation only — accepting won’t add them to Members.
              </p>
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-white">Custom questions</h3>
            <p className="text-xs font-semibold text-[#94a3c8]">
              Optional — shown on the public form after the contact fields.
            </p>
          </div>
          <button
            type="button"
            disabled={draft.custom_questions.length >= 12}
            onClick={() =>
              setDraft({
                ...draft,
                custom_questions: [...draft.custom_questions, newQuestion()],
              })
            }
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            Add question
          </button>
        </div>

        {draft.custom_questions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm font-semibold text-[#94a3c8]">
            No custom questions yet — add a few to learn why people want to join.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {draft.custom_questions.map((question, index) => (
              <div key={question.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <input
                        className={fieldClass}
                        maxLength={120}
                        value={question.label}
                        onChange={(e) => updateQuestion(index, { label: e.target.value })}
                        placeholder={`Question ${index + 1} — e.g. "Favorite tech domain?"`}
                      />
                    </div>
                    <div className="sm:w-44">
                      <select
                        className={fieldClass}
                        value={question.type}
                        onChange={(e) =>
                          updateQuestion(index, {
                            type: e.target.value as CampaignQuestionType,
                          })
                        }
                      >
                        <option value="text">Short answer</option>
                        <option value="choice">Multiple choice</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          custom_questions: moveItem(draft.custom_questions, index, -1),
                        })
                      }
                      aria-label="Move question up"
                      className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === draft.custom_questions.length - 1}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          custom_questions: moveItem(draft.custom_questions, index, 1),
                        })
                      }
                      aria-label="Move question down"
                      className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          custom_questions: draft.custom_questions.filter((_, i) => i !== index),
                        })
                      }
                      aria-label="Remove question"
                      className="rounded-lg bg-[#f43f5e]/20 p-1.5 text-[#fda4af] transition-colors hover:bg-[#f43f5e]/30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {question.type === "choice" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(question.options ?? []).map((option, optionIndex) => (
                      <span
                        key={`${question.id}-${optionIndex}`}
                        className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1"
                      >
                        <input
                          className="w-36 bg-transparent text-sm font-semibold text-white outline-none"
                          maxLength={60}
                          value={option}
                          onChange={(e) => setQuestionOption(index, optionIndex, e.target.value)}
                          placeholder="Option"
                        />
                        <button
                          type="button"
                          aria-label="Remove option"
                          onClick={() =>
                            updateQuestion(index, {
                              options: (question.options ?? []).filter((_, i) => i !== optionIndex),
                            })
                          }
                          className="text-[#94a3c8] transition-colors hover:text-[#fda4af]"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      disabled={(question.options ?? []).length >= 8}
                      onClick={() =>
                        updateQuestion(index, {
                          options: [...(question.options ?? []), ""],
                        })
                      }
                      className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                    >
                      <Plus className="size-3" />
                      Option
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="clay-md inline-flex items-center gap-2 rounded-2xl bg-[#2e6bff] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
        >
          <Check className="size-4" />
          {saving ? "Saving…" : draft.id ? "Save changes" : "Create campaign"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#94a3c8] transition-colors hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Submissions view ────────────────────────────────────────────────────────

function RegistrationsView({
  campaign,
  registrations,
  isLoading,
  onBack,
  onAccept,
  onRemove,
  onCheckIn,
}: {
  campaign: AdminCampaign;
  registrations: AdminRegistration[];
  isLoading: boolean;
  onBack: () => void;
  onAccept: (registration: AdminRegistration) => void;
  onRemove: (registration: AdminRegistration) => void;
  onCheckIn: (registration: AdminRegistration) => void;
}) {
  const questions = campaign.custom_questions ?? [];
  const [tab, setTab] = useState<"all" | "awaiting" | "interviewed" | "processed">("all");
  const [search, setSearch] = useState("");

  const counts = {
    all: registrations.length,
    pending: registrations.filter((r) => r.status === "pending").length,
    awaiting: registrations.filter((r) => r.status === "pending" && !r.checked_in).length,
    interviewed: registrations.filter((r) => r.checked_in).length,
    processed: registrations.filter((r) => r.status !== "pending").length,
  };

  const query = search.trim().toLowerCase();
  const visible = registrations.filter((registration) => {
    if (tab === "awaiting" && (registration.status !== "pending" || registration.checked_in))
      return false;
    if (tab === "interviewed" && !registration.checked_in) return false;
    if (tab === "processed" && registration.status === "pending") return false;
    if (query) {
      const haystack =
        `${registration.first_name} ${registration.last_name} ${registration.email}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "awaiting", label: "Awaiting check-in", count: counts.awaiting },
    { key: "interviewed", label: "Checked in", count: counts.interviewed },
    { key: "processed", label: "Processed", count: counts.processed },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back to all campaigns"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#94a3c8] transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
              Submissions
            </p>
            <h2 className="font-display text-xl font-bold text-white">{campaign.title}</h2>
            <p className="text-xs font-semibold text-[#94a3c8]">
              {registrations.length} total · {counts.pending} pending
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase ${
            campaign.is_open
              ? "border-[#34d399]/40 bg-[#34d399]/15 text-[#6ee7b7]"
              : "border-white/10 bg-white/5 text-[#94a3c8]"
          }`}
        >
          {campaign.is_open ? "Open" : "Closed"}
        </span>
      </div>

      {isLoading ? (
        <p className="mt-8 text-center font-semibold text-[#94a3c8]">Loading…</p>
      ) : registrations.length === 0 ? (
        <p className="admin-glass mt-8 rounded-2xl px-4 py-10 text-center font-semibold text-[#94a3c8]">
          No submissions yet — share the public link while this campaign is open.
        </p>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  aria-pressed={tab === item.key}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    tab === item.key
                      ? "border-[#2e6bff]/50 bg-[#2e6bff]/20 text-[#a5c3ff]"
                      : "border-white/10 bg-white/5 text-[#94a3c8] hover:text-white"
                  }`}
                >
                  {item.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                      tab === item.key
                        ? "bg-[#2e6bff]/30 text-[#c9dcff]"
                        : "bg-white/10 text-[#94a3c8]"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94a3c8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search submissions"
                className="w-64 rounded-xl border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm font-semibold text-white placeholder:text-[#94a3c8] outline-none focus:border-[#2e6bff]/50 focus:ring-2 focus:ring-[#2e6bff]/30"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="admin-glass mt-6 rounded-2xl px-4 py-10 text-center font-semibold text-[#94a3c8]">
              No submissions match this filter.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {visible.map((registration) => (
                <RegistrationCard
                  key={registration.id}
                  registration={registration}
                  questions={questions}
                  showDocuments={campaign.kind === "membership"}
                  onAccept={onAccept}
                  onRemove={onRemove}
                  onCheckIn={onCheckIn}
                  processed={registration.status !== "pending"}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegistrationCard({
  registration,
  questions,
  onAccept,
  onRemove,
  onCheckIn,
  processed = false,
  showDocuments = false,
}: {
  registration: AdminRegistration;
  questions: CampaignQuestion[];
  onAccept: (registration: AdminRegistration) => void;
  onRemove: (registration: AdminRegistration) => void;
  onCheckIn: (registration: AdminRegistration) => void;
  processed?: boolean;
  showDocuments?: boolean;
}) {
  const name = `${registration.first_name} ${registration.last_name}`.trim();

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        processed
          ? "border-white/5 bg-black/10 opacity-70"
          : registration.checked_in
            ? "border-[#38bdf8]/30 bg-[#38bdf8]/5"
            : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#2e6bff]/40 bg-[#2e6bff]/15 text-xs font-extrabold text-[#6fa0ff]">
            {initials(name) || "?"}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-bold text-white">{name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                  registration.status === "accepted"
                    ? "bg-[#34d399]/20 text-[#6ee7b7]"
                    : registration.status === "removed"
                      ? "bg-[#f43f5e]/15 text-[#fda4af]"
                      : "bg-[#f59e0b]/20 text-[#fcd34d]"
                }`}
              >
                {registration.status}
              </span>
              {registration.checked_in && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#38bdf8]/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#7dd3fc] uppercase">
                  <CalendarCheck className="size-3" aria-hidden="true" />
                  Interviewed
                </span>
              )}
            </div>
            <p className="text-xs text-[#94a3c8]">
              {registration.email} · {registration.phone}
            </p>
            {registration.checked_in_at && (
              <p className="text-xs text-[#7dd3fc]">
                Checked in {new Date(registration.checked_in_at).toLocaleString("en-GB")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {!processed && (
            <>
              <button
                onClick={() => onCheckIn(registration)}
                title={
                  registration.checked_in ? "Undo this check-in (mis-click)" : "Mark as interviewed"
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-extrabold transition-colors ${
                  registration.checked_in
                    ? "border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#7dd3fc] hover:bg-[#38bdf8]/20"
                    : "bg-[#38bdf8]/25 text-[#b7e4ff] hover:bg-[#38bdf8]/40"
                }`}
              >
                {registration.checked_in ? (
                  <>
                    <Undo2 className="size-4" />
                    Uncheck
                  </>
                ) : (
                  <>
                    <UserCheck className="size-4" />
                    Check In
                  </>
                )}
              </button>
              <button
                onClick={() => onAccept(registration)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#34d399]/20 px-3 py-2 text-xs font-bold text-[#6ee7b7] transition-colors hover:bg-[#34d399]/30"
              >
                <Check className="size-3.5" />
                Accept
              </button>
              <button
                onClick={() => onRemove(registration)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#f43f5e]/20 px-3 py-2 text-xs font-bold text-[#fda4af] transition-colors hover:bg-[#f43f5e]/30"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <Info label="School year" value={registration.school_year} />
        <Info label="Department" value={registration.department} />
        <Info label="Submitted" value={new Date(registration.created_at).toLocaleString("en-GB")} />
        {registration.decided_at && (
          <Info
            label={registration.status === "accepted" ? "Accepted" : "Processed"}
            value={new Date(registration.decided_at).toLocaleString("en-GB")}
          />
        )}
      </div>

      {showDocuments && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <span className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
            Documents:
          </span>
          <DocumentViewButton
            label="School certificate"
            registrationId={registration.id}
            document="school_certificate"
            present={Boolean(registration.school_certificate_url)}
          />
          <DocumentViewButton
            label="Identity card"
            registrationId={registration.id}
            document="identity_card"
            present={Boolean(registration.identity_card_url)}
          />
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-white/5 pt-3 text-sm sm:grid-cols-2">
          {questions.map((question) => {
            const answer = registration.answers?.[question.id] ?? "";
            return (
              <div key={question.id}>
                <p className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  {question.label}
                </p>
                <p className="font-semibold text-white">{answer || "—"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function DocumentViewButton({
  label,
  registrationId,
  document,
  present,
}: {
  label: string;
  registrationId: string;
  document: RegistrationDocumentKey;
  present: boolean;
}) {
  const view = useMutation({
    mutationFn: () => getRegistrationDocumentUrl({ data: { registrationId, document } }),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error) => toast.error(error.message ?? "Could not open the document"),
  });

  if (!present) {
    return (
      <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[#64748b]">
        {label}: not provided
      </span>
    );
  }

  return (
    <button
      onClick={() => view.mutate()}
      disabled={view.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e6bff]/20 px-3 py-2 text-xs font-bold text-[#6fa0ff] transition-colors hover:bg-[#2e6bff]/30 disabled:opacity-70"
    >
      <Eye className="size-3.5" />
      {view.isPending ? "Loading…" : label}
    </button>
  );
}

function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}
