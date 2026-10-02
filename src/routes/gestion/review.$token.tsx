import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DEPARTMENT_LABELS,
  decideAdminRequestAction,
  getReviewRequest,
} from "@/lib/admin-gestion-api";

export const Route = createFileRoute("/gestion/review/$token")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
  }),
  component: ReviewPage,
});

type ReviewRequest = {
  id: string;
  first_name: string;
  last_name: string;
  department: keyof typeof DEPARTMENT_LABELS;
  email: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
};

type FetchState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "ready"; request: ReviewRequest };

const inputLabel = "text-xs font-extrabold tracking-wide text-muted-foreground uppercase";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReviewPage() {
  const { token } = Route.useParams();
  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" });
  const [confirming, setConfirming] = useState<"accept" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    action: "accept" | "cancel";
    email: string;
    emailSent?: boolean;
    emailError?: string;
  } | null>(null);

  async function loadRequest(showLoading = true) {
    if (showLoading) setFetchState({ status: "loading" });
    try {
      const res = await getReviewRequest({ data: { token } });
      if (!res.ok) {
        setFetchState({ status: "invalid", message: res.message });
        return;
      }
      setFetchState({ status: "ready", request: res.request });
    } catch {
      setFetchState({ status: "invalid", message: "This request is no longer valid." });
    }
  }

  useEffect(() => {
    void loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleDecide(action: "accept" | "cancel") {
    setBusy(true);
    try {
      const res = await decideAdminRequestAction({ data: { token, action } });
      setResult({
        action: res.action,
        email: res.email,
        ...("emailSent" in res ? { emailSent: res.emailSent } : {}),
        ...("emailError" in res && res.emailError ? { emailError: res.emailError } : {}),
      });
      setConfirming(null);
    } catch {
      setBusy(false);
      setConfirming(null);
      await loadRequest(false);
    }
  }

  const request = fetchState.status === "ready" ? fetchState.request : null;
  const decided =
    result !== null || request?.status === "approved" || request?.status === "rejected";

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center px-5 py-16">
      <div className="admin-glass relative w-full max-w-md overflow-hidden rounded-3xl p-8">
        <div className="absolute -top-10 -right-8 size-32 rounded-full bg-[#2e6bff]/40 blur-2xl" />
        <div className="relative">
          <Link to="/" className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
            ← Back to Wavez Club
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold">Admin request review</h1>

          {fetchState.status === "loading" && (
            <p className="mt-6 text-sm font-semibold text-muted-foreground">Loading…</p>
          )}

          {fetchState.status === "invalid" && (
            <div className="mt-6 rounded-2xl border border-[#f43f5e]/25 bg-[#f43f5e]/15 p-5 text-sm font-semibold text-[#fda4af]">
              {fetchState.message}
            </div>
          )}

          {request && !decided && (
            <>
              <p className="mt-2 text-sm font-semibold text-[#94a3c8]">
                A new officer application is waiting for your decision.
              </p>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className={inputLabel}>Applicant</dt>
                    <dd className="mt-0.5 font-bold text-white">
                      {request.first_name} {request.last_name}
                    </dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Department / role</dt>
                    <dd className="mt-0.5 font-bold text-white">
                      {DEPARTMENT_LABELS[request.department]}
                    </dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Email</dt>
                    <dd className="mt-0.5 font-bold text-white">{request.email}</dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Phone</dt>
                    <dd className="mt-0.5 font-bold text-white">{request.phone}</dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Submitted</dt>
                    <dd className="mt-0.5 font-bold text-white">
                      {formatDate(request.created_at)}
                    </dd>
                  </div>
                </dl>
              </div>

              {confirming === null ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfirming("accept")}
                    className="clay-md rounded-2xl bg-[#2e6bff] px-6 py-3.5 font-bold text-white shadow-[0_16px_40px_-16px_rgba(46,107,255,0.7)]"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setConfirming("cancel")}
                    className="rounded-2xl border border-[#f43f5e]/25 bg-[#f43f5e]/15 px-6 py-3.5 font-bold text-[#fda4af]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                  <p className="text-sm font-bold text-white">
                    {confirming === "accept"
                      ? "Approve this applicant and send them an invite?"
                      : "Reject this application?"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#94a3c8]">
                    This action cannot be undone.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      disabled={busy}
                      onClick={() => void handleDecide(confirming)}
                      className={`clay-md rounded-2xl px-6 py-3 font-bold text-white disabled:opacity-60 ${
                        confirming === "accept"
                          ? "bg-[#2e6bff] shadow-[0_16px_40px_-16px_rgba(46,107,255,0.7)]"
                          : "bg-[#f43f5e]"
                      }`}
                    >
                      {busy ? "Confirming…" : "Yes, I'm sure"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-[#6fa0ff] disabled:opacity-60"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {request && decided && (
            <div
              className={`mt-6 rounded-2xl border p-5 text-sm font-semibold ${
                (result?.action ?? request.status) === "cancel" ||
                (result?.action ?? request.status) === "rejected"
                  ? "border-[#f43f5e]/25 bg-[#f43f5e]/15 text-[#fda4af]"
                  : "border-[#34d399]/25 bg-[#34d399]/15 text-[#6ee7b7]"
              }`}
            >
              {result === null
                ? `This request for ${request.email} was already decided.`
                : result.action === "accept"
                  ? // Only claim delivery when this response actually reports
                    // it. On a reload there is no such record, so the copy
                    // stays quiet rather than asserting something unverified.
                    result.emailSent === false
                    ? `Approved — but the invite was NOT sent to ${result.email}`
                    : `Approved — invite sent to ${result.email}`
                  : result.emailSent === false
                    ? `Rejected — the email to ${result.email} could NOT be sent`
                    : `Rejected — ${result.email} has been notified`}
              {result?.emailSent === false && (
                <p className="mt-2 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/15 p-3 text-xs font-bold text-[#fcd34d]">
                  {result.action === "accept"
                    ? "The officer is approved and their account exists, but the set-password email was NOT delivered — they cannot sign in until they receive it. Open the console and send them the link by hand."
                    : "The decision was saved, but the rejection email was not delivered, so this applicant has NOT been told. Send it by hand."}
                  {result.emailError ? ` (${result.emailError})` : ""}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold opacity-80">
                This request has already been decided and can no longer be changed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
