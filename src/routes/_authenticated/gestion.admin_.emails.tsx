import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  ChevronLeft,
  Code2,
  Megaphone,
  Send,
  ShieldAlert,
  Type,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { getAdminSession } from "@/lib/admin-admins-api";
import { listRegistrationCampaigns } from "@/lib/admin-registrations-api";
import {
  getEmailSenderInfo,
  listEmailRecipients,
  sendTemplateEmails,
  MAX_MANUAL_RECIPIENTS,
  type EmailRecipientSpec,
} from "@/lib/admin-emails-api";
import {
  EMAIL_TEMPLATE_TOKENS,
  renderEmailTemplate,
  type EmailTemplateContact,
} from "@/lib/email-template";

/**
 * The Emails page — one template, many recipients, on a page that owns its
 * whole layout (the `admin_` segment opts out of the console shell, like the
 * submissions page). This is the in-app successor to the CSV scripts in
 * `email-templates/`: the audience comes from the Members and Submissions
 * tables instead of a hand-exported file, and the live preview renders through
 * the same interpolation the server sends with.
 */
export const Route = createFileRoute("/_authenticated/gestion/admin_/emails")({
  component: EmailsPage,
});

type StatusFilter = "all" | "pending" | "accepted" | "removed" | "checked_in";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "removed", label: "Removed" },
  { value: "checked_in", label: "Checked in" },
];

/** Shown in the preview until a recipient source resolves someone real. */
const SAMPLE_CONTACT: EmailTemplateContact = {
  name: "Yasmine Boudiaf",
  first_name: "Yasmine",
  last_name: "Boudiaf",
  email: "yasmine@univ-sba.dz",
};

const fieldClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-2.5 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-brand";

const glassCard = "admin-glass rounded-3xl p-6";

function EmailsPage() {
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => getAdminSession(),
  });

  const isOwner = session?.isOwner ?? false;
  const isAdmin = isOwner || (session?.isAdmin ?? false);
  const canMembers = isOwner || (session?.sections.includes("members") ?? false);
  const canSubmissions =
    isOwner ||
    (session?.sections.includes("events") ?? false) ||
    (session?.sections.includes("registrations") ?? false);

  const [format, setFormat] = useState<"html" | "text">("html");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [source, setSource] = useState<"members" | "campaign" | "manual">("members");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [manualText, setManualText] = useState("");
  const [manualName, setManualName] = useState("");
  const [debouncedManualText, setDebouncedManualText] = useState("");

  // The count is a server round-trip keyed on the parsed addresses; a short
  // debounce keeps it from firing on every keystroke while typing.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedManualText(manualText), 350);
    return () => clearTimeout(timer);
  }, [manualText]);

  const manualParsed = useMemo(() => {
    const seen = new Set<string>();
    const entries: { email: string; name: string | null }[] = [];
    for (const raw of debouncedManualText.split(/[\s,;]+/)) {
      const email = raw.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      entries.push({ email, name: null });
    }
    return entries;
  }, [debouncedManualText]);
  const manualOverflow = manualParsed.length > MAX_MANUAL_RECIPIENTS;
  const manualEntries = manualParsed.slice(0, MAX_MANUAL_RECIPIENTS);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const body = format === "html" ? htmlBody : textBody;
  const setBody = format === "html" ? setHtmlBody : setTextBody;

  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-campaigns"],
    enabled: isAdmin && canSubmissions,
    queryFn: () => listRegistrationCampaigns(),
  });
  const effectiveCampaignId = campaignId ?? campaigns[0]?.id ?? null;

  const { data: sender } = useQuery({
    queryKey: ["email-sender-info"],
    enabled: isAdmin,
    queryFn: () => getEmailSenderInfo(),
  });

  const spec: EmailRecipientSpec | null = useMemo(() => {
    if (source === "manual") {
      if (manualEntries.length === 0) return null;
      // The name field only makes sense for one address; with several, each
      // recipient's name falls back to their address on the server.
      const name = manualEntries.length === 1 ? manualName.trim() || null : null;
      return {
        source: "manual",
        entries: manualEntries.map((entry) => ({ email: entry.email, name })),
      };
    }
    if (source === "members") return canMembers ? { source: "members" } : null;
    if (!effectiveCampaignId) return null;
    const statuses: Array<"pending" | "accepted" | "removed"> =
      statusFilter === "all" || statusFilter === "checked_in" ? [] : [statusFilter];
    return {
      source: "campaign",
      campaignId: effectiveCampaignId,
      statuses,
      checkedIn: statusFilter === "checked_in" ? true : null,
    };
  }, [source, canMembers, effectiveCampaignId, statusFilter, manualEntries, manualName]);

  const recipientsQuery = useQuery({
    queryKey: ["email-recipients", spec],
    enabled: isAdmin && spec !== null,
    queryFn: () => listEmailRecipients({ data: spec as EmailRecipientSpec }),
  });
  const recipients = recipientsQuery.data?.recipients ?? [];
  const skipped = recipientsQuery.data?.skipped ?? 0;

  const send = useMutation({
    mutationFn: () => {
      if (!spec) throw new Error("Choose who this email goes to first.");
      return sendTemplateEmails({
        data: { subject, body, format, recipient: spec },
      });
    },
    onSuccess: (result) => {
      if (result.failed === 0) {
        toast.success(`Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}.`);
        return;
      }
      toast.warning(
        `Sent ${result.sent} of ${result.total}. Failed: ${result.failures.join(", ")}`,
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Sending failed — try again."),
  });

  const insertToken = (token: string) => {
    const el = editorRef.current;
    if (!el) {
      setBody(body + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? start;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and template are required.");
      return;
    }
    if (recipientsQuery.isFetching) {
      toast.error("Recipients are still loading.");
      return;
    }
    if (recipients.length === 0) {
      toast.error("No recipients with a valid email address.");
      return;
    }
    const count = recipients.length;
    if (!confirm(`Send "${subject.trim()}" to ${count} recipient${count === 1 ? "" : "s"}?`)) {
      return;
    }
    send.mutate();
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const logoUrl = `${origin}/wavez-logo-email.png`;
  const previewContact = recipients[0] ?? SAMPLE_CONTACT;
  const previewBody = renderEmailTemplate(body, previewContact, {
    escape: format === "html",
    logoUrl,
  });

  if (sessionLoading) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center">
        <p className="font-bold text-white">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-theme grid min-h-screen place-items-center px-5">
        <div className="admin-glass max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert className="mx-auto size-8 text-[#fcd34d]" />
          <h1 className="mt-3 font-display text-xl font-bold text-white">
            This page is for club officers
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
            Sign in with an admin account to send club emails.
          </p>
          <Link
            to="/gestion"
            className="clay-sm mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-[#2e6bff] px-5 py-2.5 text-sm font-bold text-white"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-theme min-h-screen">
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8">
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/gestion/admin"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#94a3c8] transition-colors hover:text-white"
          >
            <ChevronLeft className="size-4" />
            Admin console
          </Link>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
              Club outreach
            </p>
            <h1 className="font-display text-3xl font-bold text-white">Emails</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-[#94a3c8]">
              Write a template once, personalize it per recipient, and send it to the club or to one
              announcement&apos;s students. The preview is exactly what lands in the inbox.
            </p>
          </div>
          {sender && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
              <p className="text-[11px] font-extrabold tracking-wide text-[#94a3c8] uppercase">
                Sending from
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">{sender.from}</p>
              {sender.replyTo && (
                <p className="text-xs font-semibold text-[#94a3c8]">
                  Replies go to {sender.replyTo}
                </p>
              )}
            </div>
          )}
        </div>

        {sender && !sender.configured && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#fcd34d]" />
            <p className="text-sm font-semibold text-[#fcd34d]">
              RESEND_API_KEY is not configured on the server, so sending is disabled. Set it in the
              deployment environment, then reload this page.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <section className={glassCard}>
              <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                Send to
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSource("members")}
                  disabled={!canMembers}
                  className={`rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    source === "members"
                      ? "border-[#2e6bff]/60 bg-[#2e6bff]/15"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <Users
                    className={`size-5 ${source === "members" ? "text-[#6fa0ff]" : "text-[#94a3c8]"}`}
                  />
                  <p className="mt-2 text-sm font-bold text-white">Members</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                    Every club member&apos;s email address
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSource("campaign")}
                  disabled={!canSubmissions}
                  className={`rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    source === "campaign"
                      ? "border-[#2e6bff]/60 bg-[#2e6bff]/15"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <Megaphone
                    className={`size-5 ${source === "campaign" ? "text-[#6fa0ff]" : "text-[#94a3c8]"}`}
                  />
                  <p className="mt-2 text-sm font-bold text-white">A submission</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                    The students who applied to one announcement
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSource("manual")}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    source === "manual"
                      ? "border-[#2e6bff]/60 bg-[#2e6bff]/15"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <AtSign
                    className={`size-5 ${source === "manual" ? "text-[#6fa0ff]" : "text-[#94a3c8]"}`}
                  />
                  <p className="mt-2 text-sm font-bold text-white">Someone specific</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                    Type email addresses by hand
                  </p>
                </button>
              </div>

              {source === "manual" && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-xs font-extrabold text-muted-foreground uppercase">
                      Email addresses
                    </label>
                    <textarea
                      rows={3}
                      className={`${fieldClass} font-mono text-xs`}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder={"name@example.com\nsecond@example.com"}
                    />
                    <p className="mt-1 text-[11px] font-semibold text-[#94a3c8]">
                      One per line, or separated by commas. Invalid addresses are skipped
                      automatically.
                    </p>
                    {manualOverflow && (
                      <p className="mt-1 text-[11px] font-bold text-[#fcd34d]">
                        Only the first {MAX_MANUAL_RECIPIENTS} addresses are used per send.
                      </p>
                    )}
                  </div>
                  {manualEntries.length === 1 && (
                    <div>
                      <label className="text-xs font-extrabold text-muted-foreground uppercase">
                        Name (optional)
                      </label>
                      <input
                        className={fieldClass}
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Yasmine Boudiaf — fills {{first_name}} / {{name}}"
                      />
                    </div>
                  )}
                </div>
              )}

              {source === "campaign" && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-xs font-extrabold text-muted-foreground uppercase">
                      Announcement
                    </label>
                    <select
                      className={fieldClass}
                      value={effectiveCampaignId ?? ""}
                      onChange={(e) => setCampaignId(e.target.value || null)}
                    >
                      {campaigns.length === 0 && <option value="">No submissions yet</option>}
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.title} · {campaign.submission_count} submission
                          {campaign.submission_count === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-muted-foreground uppercase">
                      Student status
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {STATUS_FILTERS.map((filter) => (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setStatusFilter(filter.value)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
                            statusFilter === filter.value
                              ? "bg-[#2e6bff] text-white"
                              : "border border-white/10 bg-black/20 text-[#94a3c8] hover:text-white"
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-sm font-bold text-white">
                  {recipientsQuery.isLoading
                    ? "Counting recipients…"
                    : `${recipients.length} recipient${recipients.length === 1 ? "" : "s"} with a valid email`}
                </p>
                {skipped > 0 && !recipientsQuery.isLoading && (
                  <p className="mt-0.5 text-xs font-semibold text-[#94a3c8]">
                    {skipped} skipped — missing, invalid or duplicate address
                    {skipped === 1 ? "" : "es"}.
                  </p>
                )}
              </div>
            </section>

            <section className={glassCard}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setFormat("html")}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
                      format === "html"
                        ? "bg-[#2e6bff] text-white"
                        : "text-[#94a3c8] hover:text-white"
                    }`}
                  >
                    <Code2 className="size-3.5" />
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat("text")}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
                      format === "text"
                        ? "bg-[#2e6bff] text-white"
                        : "text-[#94a3c8] hover:text-white"
                    }`}
                  >
                    <Type className="size-3.5" />
                    Text
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-[#94a3c8]">
                  {format === "html"
                    ? "Sent as a designed email — paste your HTML below."
                    : "Sent as plain text — no HTML tags."}
                </p>
              </div>

              <div className="mt-4">
                <label className="text-xs font-extrabold text-muted-foreground uppercase">
                  Subject
                </label>
                <input
                  className={fieldClass}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="{{first_name}}, you're invited — Wavez Club"
                />
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-muted-foreground uppercase">
                    Template
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMAIL_TEMPLATE_TOKENS.map(({ token, label }) => (
                      <button
                        key={token}
                        type="button"
                        title={`Insert ${label}`}
                        onClick={() => insertToken(token)}
                        className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[10px] font-bold text-[#a5c3ff] transition-colors hover:border-[#2e6bff]/60 hover:text-white"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={editorRef}
                  rows={16}
                  spellCheck={false}
                  className={`${fieldClass} font-mono text-xs leading-relaxed`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    format === "html"
                      ? "<p>Hi {{first_name}},</p>\n<p>…</p>"
                      : "Hi {{first_name}},\n\n…"
                  }
                />
              </div>

              <button
                type="button"
                onClick={handleSend}
                disabled={
                  send.isPending ||
                  !subject.trim() ||
                  !body.trim() ||
                  recipients.length === 0 ||
                  (sender ? !sender.configured : false)
                }
                className="clay-md mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2e6bff] px-6 py-3.5 font-bold text-white shadow-[0_14px_38px_-16px_rgba(46,107,255,0.7)] disabled:opacity-60"
              >
                <Send className="size-4" />
                {send.isPending
                  ? "Sending…"
                  : `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`}
              </button>
            </section>
          </div>

          <aside className="self-start lg:sticky lg:top-6">
            <section className={glassCard}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold tracking-wide text-[#6fa0ff] uppercase">
                  Preview
                </p>
                <p className="text-[11px] font-semibold text-[#94a3c8]">
                  Rendering as {previewContact.name}
                  {recipients.length > 0 ? " (first recipient)" : " (sample)"}
                </p>
              </div>
              {format === "html" ? (
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={previewBody}
                  className="mt-4 h-[560px] w-full rounded-2xl border border-white/10 bg-white"
                />
              ) : (
                <pre className="mt-4 h-[560px] overflow-auto rounded-2xl border border-white/10 bg-white p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[#1a1a1a]">
                  {previewBody || "(empty template)"}
                </pre>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
