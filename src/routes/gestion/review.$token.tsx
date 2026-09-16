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
  const [result, setResult] = useState<{ action: "accept" | "cancel"; email: string } | null>(null);

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
      setResult({ action: res.action, email: res.email });
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
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="clay-lg relative w-full max-w-md overflow-hidden rounded-3xl bg-card p-8">
        <div className="clay-sm animate-floaty absolute -top-8 -right-6 size-24 rounded-full bg-lemon" />
        <div className="relative">
          <Link to="/" className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
            ← Back to Wavez Club
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold">Admin request review</h1>

          {fetchState.status === "loading" && (
            <p className="mt-6 text-sm font-semibold text-muted-foreground">Loading…</p>
          )}

          {fetchState.status === "invalid" && (
            <div className="clay-sm mt-6 rounded-2xl bg-red-100 p-5 text-sm font-semibold text-red-700">
              {fetchState.message}
            </div>
          )}

          {request && !decided && (
            <>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                A new officer application is waiting for your decision.
              </p>

              <div className="clay-sm mt-6 rounded-2xl bg-background p-5">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className={inputLabel}>Applicant</dt>
                    <dd className="mt-0.5 font-bold text-foreground">
                      {request.first_name} {request.last_name}
                    </dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Department / role</dt>
                    <dd className="mt-0.5 font-bold text-foreground">
                      {DEPARTMENT_LABELS[request.department]}
                    </dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Email</dt>
                    <dd className="mt-0.5 font-bold text-foreground">{request.email}</dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Phone</dt>
                    <dd className="mt-0.5 font-bold text-foreground">{request.phone}</dd>
                  </div>
                  <div>
                    <dt className={inputLabel}>Submitted</dt>
                    <dd className="mt-0.5 font-bold text-foreground">
                      {formatDate(request.created_at)}
                    </dd>
                  </div>
                </dl>
              </div>

              {confirming === null ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfirming("accept")}
                    className="clay-md rounded-2xl bg-brand px-6 py-3.5 font-bold text-primary-foreground"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setConfirming("cancel")}
                    className="clay-sm rounded-2xl bg-red-100 px-6 py-3.5 font-bold text-red-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="clay-sm mt-6 rounded-2xl bg-background p-5 text-center">
                  <p className="text-sm font-bold text-foreground">
                    {confirming === "accept"
                      ? "Approve this applicant and send them an invite?"
                      : "Reject this application?"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    This action cannot be undone.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      disabled={busy}
                      onClick={() => void handleDecide(confirming)}
                      className={`clay-md rounded-2xl px-6 py-3 font-bold text-primary-foreground disabled:opacity-60 ${
                        confirming === "accept" ? "bg-brand" : "bg-red-600"
                      }`}
                    >
                      {busy ? "Confirming…" : "Yes, I'm sure"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                      className="clay-sm rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep disabled:opacity-60"
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
              className={`clay-sm mt-6 rounded-2xl p-5 text-sm font-semibold ${
                (result?.action ?? request.status) === "cancel" ||
                (result?.action ?? request.status) === "rejected"
                  ? "bg-red-100 text-red-700"
                  : "bg-mint/30 text-mint-foreground"
              }`}
            >
              {(result?.action ?? request.status) === "accept" ||
              (result?.action ?? request.status) === "approved"
                ? `Approved — invite sent to ${result?.email ?? request.email}`
                : result !== null
                  ? "Rejected"
                  : `Rejected — ${request.email} has been notified`}
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
