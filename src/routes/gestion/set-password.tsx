import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gestion/set-password")({
  head: () => ({
    meta: [
      { title: "Set your password — Wavez Club" },
      { name: "description", content: "Choose a password for your Wavez Club officer account." },
      { property: "og:title", content: "Set your password — Wavez Club" },
      {
        property: "og:description",
        content: "Choose a password for your Wavez Club officer account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetPasswordPage,
});

type State = "checking" | "ready" | "invalid" | "saved";

const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand";

/** Supabase's own floor is 6; an officer account deserves better than that. */
const MIN_LENGTH = 8;

/**
 * An invite link arrives as `<redirectTo>#access_token=...&type=invite` on the
 * implicit flow this client uses (flowType is left unset, so supabase-js
 * defaults to implicit, and detectSessionInUrl is left on). GoTrue strips the
 * hash as soon as it has exchanged it for a session, so the raw value is
 * captured during the first render and kept in state.
 */
function readHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(raw);
  // PKCE projects deliver the token as ?code= instead; copy it in so the
  // "did this link carry a token" check works for both flows.
  const code = new URLSearchParams(window.location.search).get("code");
  if (code && !params.get("code")) params.set("code", code);
  return params;
}

function SetPasswordPage() {
  const [state, setState] = useState<State>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const params = readHashParams();

      // GoTrue reports an expired, revoked or already-used link here.
      const errCode = params.get("error_code");
      const errDesc = params.get("error_description");
      if (errCode || errDesc) {
        if (!cancelled) {
          setLinkError(errDesc?.replace(/\+/g, " ") ?? "This link is no longer valid.");
          setState("invalid");
        }
        return;
      }

      // A session is only established after the hash has been exchanged, which
      // is asynchronous, so poll briefly rather than deciding on first read.
      // ~5s is far longer than the exchange takes; going slower would just make
      // a person with a dead link stare at a spinner.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setState("ready");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      if (!cancelled) {
        setLinkError(
          "This page needs a valid invitation link. Open the most recent link from your Wavez Club invitation email.",
        );
        setState("invalid");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < MIN_LENGTH) {
      toast.error(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      toast.error("Those two passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // The invite already established a session, so the officer is signed in and
    // can go straight to the console rather than typing the password again.
    setState("saved");
  }

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center px-5 py-16">
      <div className="admin-glass relative w-full max-w-md overflow-hidden rounded-3xl p-8">
        <div className="absolute -top-10 -right-8 size-32 rounded-full bg-[#2e6bff]/40 blur-2xl" />
        <div className="relative">
          <Link to="/" className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
            ← Back to Wavez Club
          </Link>

          <h1 className="mt-4 font-display text-3xl font-bold">
            {state === "saved" ? "Password set" : "Set your password"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {state === "checking"
              ? "Checking your invitation link…"
              : state === "invalid"
                ? "This invitation link cannot be used."
                : state === "saved"
                  ? "You are signed in and your password is active."
                  : "Choose a password for your Wavez Club officer account."}
          </p>

          {state === "invalid" ? (
            <div className="mt-6 rounded-2xl border border-[#f87171]/25 bg-[#f87171]/15 p-5 text-sm font-semibold text-[#fca5a5]">
              <p>{linkError}</p>
              <p className="mt-3 text-xs text-[#fecaca]">
                Invitation links expire, and each one only works once. Ask the club to send a new
                invitation if this keeps happening.
              </p>
              <Link
                to="/gestion"
                className="mt-4 inline-block text-xs font-extrabold tracking-wide text-[#fca5a5] underline"
              >
                Go to sign in
              </Link>
            </div>
          ) : state === "saved" ? (
            <div className="mt-6 rounded-2xl border border-[#34d399]/25 bg-[#34d399]/15 p-5 text-sm font-semibold text-[#6ee7b7]">
              <p>Your password has been saved and you are already signed in.</p>
              <Link
                to="/gestion/admin"
                className="clay-md mt-4 block rounded-2xl bg-[#2e6bff] px-6 py-3 text-center font-bold text-white shadow-[0_16px_40px_-16px_rgba(46,107,255,0.7)]"
              >
                Go to the member console
              </Link>
              <Link
                to="/gestion"
                className="mt-3 block text-center text-xs font-extrabold tracking-wide text-[#6ee7b7] underline"
              >
                Sign in as someone else
              </Link>
            </div>
          ) : state === "ready" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                  New password
                </label>
                <input
                  type="password"
                  required
                  minLength={MIN_LENGTH}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                  At least {MIN_LENGTH} characters.
                </p>
              </div>
              <div>
                <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  minLength={MIN_LENGTH}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="clay-md w-full rounded-2xl bg-[#2e6bff] px-6 py-3.5 font-bold text-white shadow-[0_16px_40px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
              >
                {busy ? "Please wait…" : "Save password"}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-2" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="clay-sm h-[4.5rem] rounded-2xl bg-background/60" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
