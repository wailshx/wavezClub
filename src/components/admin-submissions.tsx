import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  Search,
  Trash2,
  Undo2,
  UserCheck,
  X,
} from "lucide-react";

import {
  acceptRegistration,
  deleteRegistration,
  getRegistrationDocumentUrl,
  listCampaignRegistrations,
  removeRegistration,
  toggleRegistrationCheckIn,
  type AdminCampaign,
  type AdminRegistration,
  type RegistrationDocumentKey,
} from "@/lib/admin-registrations-api";
import {
  MAX_CUSTOM_QUESTIONS,
  MAX_QUESTION_OPTIONS,
  type CampaignQuestion,
  type CampaignQuestionType,
} from "@/lib/registrations";
import { initials } from "@/lib/club";

const fieldClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand";

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

// ─── Custom questions editor ─────────────────────────────────────────────────

/**
 * Editor for the questions an applicant answers after the contact fields.
 *
 * Lives in its own component because it is used in two places: the standalone
 * campaign editor below, and the announcement form in the Submissions tab, which
 * now owns these questions. Both must behave identically, so there is one
 * implementation.
 */
export function CustomQuestionsEditor({
  questions,
  onChange,
}: {
  questions: CampaignQuestion[];
  onChange: (questions: CampaignQuestion[]) => void;
}) {
  const updateQuestion = (index: number, patch: Partial<CampaignQuestion>) => {
    onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  };

  const setQuestionOption = (index: number, optionIndex: number, value: string) => {
    const question = questions[index];
    if (!question) return;
    onChange(
      questions.map((item, i) =>
        i === index
          ? {
              ...item,
              options: (item.options ?? []).map((o, j) => (j === optionIndex ? value : o)),
            }
          : item,
      ),
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-white">Questions for applicants</h3>
          <p className="text-xs font-semibold text-[#94a3c8]">
            Optional — asked on the application form in the card, after the contact fields.
          </p>
        </div>
        <button
          type="button"
          disabled={questions.length >= MAX_CUSTOM_QUESTIONS}
          onClick={() => onChange([...questions, newQuestion()])}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Add question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm font-semibold text-[#94a3c8]">
          No questions yet — add a few to learn why people want to join.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {questions.map((question, index) => (
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
                    onClick={() => onChange(moveItem(questions, index, -1))}
                    aria-label="Move question up"
                    className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === questions.length - 1}
                    onClick={() => onChange(moveItem(questions, index, 1))}
                    aria-label="Move question down"
                    className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94a3c8] transition-colors hover:text-white disabled:opacity-40"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(questions.filter((_, i) => i !== index))}
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
                    disabled={(question.options ?? []).length >= MAX_QUESTION_OPTIONS}
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
  );
}

// ─── Submissions view ────────────────────────────────────────────────────────

export function RegistrationsView({
  campaign,
  registrations,
  isLoading,
  onBack,
  hideBack = false,
  onAccept,
  onRemove,
  onCheckIn,
  onDelete,
}: {
  campaign: AdminCampaign;
  registrations: AdminRegistration[];
  isLoading: boolean;
  onBack: () => void;
  /** The submissions hang off an announcement, so there is no list to go back to. */
  hideBack?: boolean;
  onAccept: (registration: AdminRegistration) => void;
  onRemove: (registration: AdminRegistration) => void;
  onCheckIn: (registration: AdminRegistration) => void;
  onDelete: (registration: AdminRegistration) => void;
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
          {!hideBack && (
            <button
              onClick={onBack}
              aria-label="Back to all campaigns"
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#94a3c8] transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
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
            <RegistrationTable
              registrations={visible}
              questions={questions}
              showDocuments={campaign.kind === "membership"}
              onAccept={onAccept}
              onRemove={onRemove}
              onCheckIn={onCheckIn}
              onDelete={onDelete}
            />
          )}
        </div>
      )}
    </div>
  );
}

const fullName = (registration: AdminRegistration) =>
  `${registration.first_name} ${registration.last_name}`.trim();

const STATUS_PILL_CLASS: Record<string, string | undefined> = {
  accepted: "bg-[#34d399]/20 text-[#6ee7b7]",
  removed: "bg-[#f43f5e]/15 text-[#fda4af]",
  pending: "bg-[#f59e0b]/20 text-[#fcd34d]",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
        STATUS_PILL_CLASS[status] ?? STATUS_PILL_CLASS["pending"]
      }`}
    >
      {status}
    </span>
  );
}

function DiscloseIcon({ open }: { open: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={`size-4 shrink-0 text-[#64748b] transition-transform ${open ? "rotate-180" : ""}`}
    />
  );
}

function RegistrationActions({
  registration,
  onAccept,
  onRemove,
  onCheckIn,
  onDelete,
  processed = false,
  compact = false,
}: {
  registration: AdminRegistration;
  onAccept: (registration: AdminRegistration) => void;
  onRemove: (registration: AdminRegistration) => void;
  onCheckIn: (registration: AdminRegistration) => void;
  onDelete: (registration: AdminRegistration) => void;
  processed?: boolean;
  compact?: boolean;
}) {
  if (processed) return null;
  const pad = compact ? "px-2.5 py-1.5" : "px-3 py-2.5";

  return (
    <>
      <button
        onClick={() => onCheckIn(registration)}
        title={registration.checked_in ? "Undo this check-in (mis-click)" : "Mark as interviewed"}
        className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors ${pad} ${
          registration.checked_in
            ? "border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#7dd3fc] hover:bg-[#38bdf8]/20"
            : "bg-[#38bdf8]/25 text-[#b7e4ff] hover:bg-[#38bdf8]/40"
        }`}
      >
        {registration.checked_in ? (
          <Undo2 className="size-4" aria-hidden="true" />
        ) : (
          <UserCheck className="size-4" aria-hidden="true" />
        )}
        {registration.checked_in ? "Uncheck" : "Check In"}
      </button>
      <button
        onClick={() => onAccept(registration)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-[#34d399]/20 text-xs font-bold whitespace-nowrap text-[#6ee7b7] transition-colors hover:bg-[#34d399]/30 ${pad}`}
      >
        <Check className="size-3.5" aria-hidden="true" />
        Accept
      </button>
      <button
        onClick={() => onRemove(registration)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-[#f43f5e]/20 text-xs font-bold whitespace-nowrap text-[#fda4af] transition-colors hover:bg-[#f43f5e]/30 ${pad}`}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        Remove
      </button>
      <button
        onClick={() => onDelete(registration)}
        title="Delete this submission and its documents for good"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold whitespace-nowrap text-[#64748b] transition-colors hover:border-[#f43f5e]/40 hover:bg-[#f43f5e]/10 hover:text-[#fda4af] ${pad}`}
      >
        <X className="size-3.5" aria-hidden="true" />
        Delete
      </button>
    </>
  );
}

function RegistrationDetails({
  registration,
  questions,
  showDocuments,
}: {
  registration: AdminRegistration;
  questions: CampaignQuestion[];
  showDocuments: boolean;
}) {
  return (
    <>
      <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Info label="Email" value={registration.email} />
        <Info label="Phone" value={registration.phone} />
        <Info label="Department" value={registration.department} />
        <Info label="School year" value={registration.school_year} />
        <Info label="Submitted" value={new Date(registration.created_at).toLocaleString("en-GB")} />
        {registration.checked_in_at && (
          <Info
            label="Checked in"
            value={new Date(registration.checked_in_at).toLocaleString("en-GB")}
          />
        )}
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
        <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-white/5 pt-3 text-sm sm:grid-cols-2">
          {questions.map((question) => {
            const answer = registration.answers?.[question.id] ?? "";
            return (
              <div key={question.id}>
                <p className="text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
                  {question.label}
                </p>
                <p className="font-semibold text-white">{answer || "\u2014"}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function RegistrationTable({
  registrations,
  questions,
  showDocuments,
  onAccept,
  onRemove,
  onCheckIn,
  onDelete,
}: {
  registrations: AdminRegistration[];
  questions: CampaignQuestion[];
  showDocuments: boolean;
  onAccept: (registration: AdminRegistration) => void;
  onRemove: (registration: AdminRegistration) => void;
  onCheckIn: (registration: AdminRegistration) => void;
  onDelete: (registration: AdminRegistration) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded((current) => (current === id ? null : id));

  const actionsFor = (registration: AdminRegistration) => (
    <RegistrationActions
      registration={registration}
      onAccept={onAccept}
      onRemove={onRemove}
      onCheckIn={onCheckIn}
      onDelete={onDelete}
      processed={registration.status !== "pending"}
      compact
    />
  );

  return (
    <>
      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04] text-left text-xs font-extrabold tracking-wide text-[#94a3c8] uppercase">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Department</th>
              <th className="hidden px-4 py-3 lg:table-cell">Level</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 xl:table-cell">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {registrations.map((registration) => {
              const name = fullName(registration);
              const isOpen = expanded === registration.id;

              return (
                <Fragment key={registration.id}>
                  <tr
                    onClick={() => toggle(registration.id)}
                    className={`cursor-pointer hover:bg-white/[0.03] ${
                      registration.status !== "pending"
                        ? "bg-black/10 opacity-70"
                        : registration.checked_in
                          ? "bg-[#38bdf8]/5"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} details for ${name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(registration.id);
                        }}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#2e6bff]/40 bg-[#2e6bff]/15 text-[11px] font-extrabold text-[#6fa0ff]">
                          {initials(name) || "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-sm font-bold text-white">
                            {name}
                          </span>
                          <span className="block truncate text-xs text-[#94a3c8]">
                            {registration.email}
                          </span>
                          <span className="block truncate text-xs text-[#64748b]">
                            {registration.phone}
                          </span>
                        </span>
                        <DiscloseIcon open={isOpen} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-white">
                      {registration.department}
                    </td>
                    <td className="hidden px-4 py-3 font-semibold whitespace-nowrap text-white lg:table-cell">
                      {registration.school_year}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusPill status={registration.status} />
                        {registration.checked_in && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#38bdf8]/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#7dd3fc] uppercase">
                            <CalendarCheck className="size-3" aria-hidden="true" />
                            <span className="hidden xl:inline">Interviewed</span>
                            <span className="xl:hidden">Done</span>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-[#94a3c8] xl:table-cell">
                      {new Date(registration.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {actionsFor(registration)}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="bg-black/30 px-4 py-4">
                        <RegistrationDetails
                          registration={registration}
                          questions={questions}
                          showDocuments={showDocuments}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* A table cannot reflow on a phone, so the same data becomes a stack of
          cards. Same expansion, same actions, no second source of truth. */}
      <ul className="mt-4 space-y-3 sm:hidden">
        {registrations.map((registration) => {
          const name = fullName(registration);
          const isOpen = expanded === registration.id;

          return (
            <li
              key={registration.id}
              className={`rounded-2xl border p-3 ${
                registration.status !== "pending"
                  ? "border-white/5 bg-black/10 opacity-70"
                  : registration.checked_in
                    ? "border-[#38bdf8]/30 bg-[#38bdf8]/5"
                    : "border-white/10 bg-black/20"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(registration.id)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-bold text-white">
                    {name}
                  </span>
                  <span className="block truncate text-xs text-[#94a3c8]">
                    {registration.department} \u00b7 {registration.school_year}
                  </span>
                </span>
                <StatusPill status={registration.status} />
                <DiscloseIcon open={isOpen} />
              </button>
              {isOpen && (
                <div className="mt-3">
                  <RegistrationDetails
                    registration={registration}
                    questions={questions}
                    showDocuments={showDocuments}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">{actionsFor(registration)}</div>
            </li>
          );
        })}
      </ul>
    </>
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
// ─── Per-announcement submissions inbox ──────────────────────────────────────

/**
 * The submissions that came back for one announcement, with review and check-in.
 *
 * This used to be reached by picking a campaign in its own Registrations tab.
 * Campaigns are no longer edited on their own — an announcement *is* the
 * submission — so this hangs off the announcement in the Submissions tab and
 * owns only the query and the three mutations, with no campaign list above it.
 */
export function CampaignSubmissions({
  campaign,
  inline = true,
}: {
  campaign: AdminCampaign;
  /** False when this is the campaign's own page rather than a panel in the console. */
  inline?: boolean;
}) {
  const queryClient = useQueryClient();
  const [acceptTarget, setAcceptTarget] = useState<AdminRegistration | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminRegistration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRegistration | null>(null);

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["campaign-registrations", campaign.id],
    queryFn: () => listCampaignRegistrations({ data: campaign.id }),
  });

  const accept = useMutation({
    mutationFn: (id: string) => acceptRegistration({ data: id }),
    onSuccess: () => {
      toast.success(
        campaign.kind === "event"
          ? "Submission accepted — confirmed for the event"
          : "Submission accepted — member added",
      );
      setAcceptTarget(null);
      queryClient.invalidateQueries({ queryKey: ["campaign-registrations", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not accept the submission"),
  });

  const checkIn = useMutation({
    mutationFn: (input: { id: string; checked_in: boolean }) =>
      toggleRegistrationCheckIn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-registrations", campaign.id] });
    },
    onError: (error) => toast.error(error.message ?? "Could not update check-in"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeRegistration({ data: id }),
    onSuccess: () => {
      toast.success("Submission removed");
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["campaign-registrations", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not remove the submission"),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => deleteRegistration({ data: id }),
    onSuccess: () => {
      toast.success("Submission deleted permanently");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["campaign-registrations", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (error) => toast.error(error.message ?? "Could not delete the submission"),
  });

  const modalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <div className={inline ? "mt-4 border-t border-white/10 pt-4" : undefined}>
      <RegistrationsView
        campaign={campaign}
        registrations={registrations}
        isLoading={isLoading}
        onBack={() => undefined}
        hideBack
        onAccept={(registration) => setAcceptTarget(registration)}
        onRemove={(registration) => setRemoveTarget(registration)}
        onCheckIn={(registration) =>
          checkIn.mutate({ id: registration.id, checked_in: !registration.checked_in })
        }
        onDelete={(registration) => setDeleteTarget(registration)}
      />

      {modalRoot &&
        (acceptTarget || removeTarget || deleteTarget) &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-5 py-10 backdrop-blur-sm"
            role="presentation"
          >
            <div className="admin-glass-strong w-full max-w-md overflow-y-auto rounded-3xl p-7">
              {acceptTarget && (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Accept submission</h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    Accept{" "}
                    <span className="text-white">
                      {acceptTarget.first_name} {acceptTarget.last_name}
                    </span>{" "}
                    ({acceptTarget.email}) —{" "}
                    {campaign.kind === "event" ? (
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
                      This student hasn&apos;t been checked in for interview yet.
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
                        : campaign.kind === "event"
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
                    from this submission. They will be marked as removed and{" "}
                    <span className="text-[#fcd34d]">won&apos;t</span> be added to Members.
                  </p>
                  {!removeTarget.checked_in && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2 text-xs font-bold text-[#fcd34d]">
                      <CalendarCheck className="mt-0.5 size-3.5 shrink-0" />
                      This student hasn&apos;t been checked in for interview yet.
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

              {deleteTarget && (
                <>
                  <h2 className="font-display text-xl font-bold text-white">
                    Delete this submission for good
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                    This permanently deletes{" "}
                    <span className="text-white">
                      {deleteTarget.first_name} {deleteTarget.last_name}
                    </span>{" "}
                    ({deleteTarget.email}) and{" "}
                    <span className="text-[#fcd34d]">their uploaded documents</span>. It cannot be
                    undone — use <span className="text-white">Remove</span> instead if you only want
                    to set this application aside.
                  </p>
                  {deleteTarget.status === "accepted" && campaign.kind === "membership" && (
                    <p className="mt-2 rounded-xl border border-[#34d399]/30 bg-[#34d399]/10 px-3 py-2 text-xs font-bold text-[#6ee7b7]">
                      This student was accepted, so they are already a member. Deleting the
                      application does <span className="text-white">not</span> remove them from
                      Members — edit their member record separately.
                    </p>
                  )}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => destroy.mutate(deleteTarget.id)}
                      disabled={destroy.isPending}
                      className="clay-md rounded-2xl bg-[#f43f5e] px-6 py-3 font-bold text-white shadow-[0_14px_38px_-16px_rgba(244,63,94,0.6)] disabled:opacity-70"
                    >
                      {destroy.isPending ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(null)}
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
