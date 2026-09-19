import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  SUBMITTABLE_ADMIN_ROLES,
  adminRequestSchema,
  submitAdminRequestAction,
} from "@/lib/admin-gestion-api";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gestion/")({
  head: () => ({
    meta: [
      { title: "Club sign in — Wavez Club" },
      { name: "description", content: "Sign in or apply to join the Wavez Club officer team." },
      { property: "og:title", content: "Club sign in — Wavez Club" },
      {
        property: "og:description",
        content: "Club officers sign in to the Wavez Club member console.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestionPage,
});

const OWNER_EMAIL = (import.meta.env["VITE_OWNER_EMAIL"] as string | undefined) ?? "";

const DEPARTMENT_LABELS: Record<(typeof SUBMITTABLE_ADMIN_ROLES)[number], string> = {
  vice_president: "Vice President",
  media_leader: "Media Leader",
  vice_media_leader: "Vice Media Leader",
  hr_leader: "HR Leader",
  vice_hr_leader: "Vice HR Leader",
};

const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand";

type Mode = "signin" | "request" | "owner-setup";

function GestionPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [department, setDepartment] =
    useState<(typeof SUBMITTABLE_ADMIN_ROLES)[number]>("vice_president");
  const [requestEmail, setRequestEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/gestion/admin" });
    }
    void run();
  }, [navigate]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/gestion/admin" });
  }

  async function handleOwnerSetup(event: React.FormEvent) {
    event.preventDefault();
    if (email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      toast.info("This form is reserved for the club owner. You can apply for a role instead.");
      setMode("request");
      setRequestEmail(email);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/gestion/admin` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCheckEmail(true);
  }

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    const parsed = adminRequestSchema.safeParse({
      firstName,
      lastName,
      department,
      email: requestEmail,
      phone,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your answers");
      return;
    }
    setBusy(true);
    const res = await submitAdminRequestAction({ data: parsed.data });
    setBusy(false);
    if (res.ok) {
      setRequestSent(true);
    } else {
      toast.error(res.message);
    }
  }

  function switchMode(next: Mode) {
    setCheckEmail(false);
    setMode(next);
  }

  const heading: Record<Mode, string> = {
    signin: "Club sign in",
    request: "Apply for a club role",
    "owner-setup": "Club owner — set up your account",
  };

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center px-5 py-16">
      <div className="admin-glass relative w-full max-w-md overflow-hidden rounded-3xl p-8">
        <div className="absolute -top-10 -right-8 size-32 rounded-full bg-[#2e6bff]/40 blur-2xl" />
        <div className="relative">
          <Link to="/" className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
            ← Back to Wavez Club
          </Link>

          <h1 className="mt-4 font-display text-3xl font-bold">{heading[mode]}</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {mode === "signin"
              ? "Club officers sign in to manage Wavez Club."
              : mode === "request"
                ? "Tell us who you are — the club will review your application."
                : "Only the club owner can use this."}
          </p>

          {requestSent ? (
            <div className="mt-6 rounded-2xl border border-[#34d399]/25 bg-[#34d399]/15 p-5 text-sm font-semibold text-[#6ee7b7]">
              <p className="font-display text-lg font-bold">
                Your request has been sent for review.
              </p>
              <p className="mt-2">
                We received your application for{" "}
                <span className="font-bold">{DEPARTMENT_LABELS[department]}</span>. The club will
                review it shortly — an invitation will arrive at{" "}
                <span className="font-bold">{requestEmail}</span> if your request is approved.
              </p>
              {OWNER_EMAIL && (
                <p className="mt-3 border-t border-[#34d399]/20 pt-3 text-xs text-[#a7f3d0]">
                  Questions? Contact the club owner at{" "}
                  <span className="font-bold">{OWNER_EMAIL}</span>.
                </p>
              )}
              <button
                onClick={() => setRequestSent(false)}
                className="mt-4 text-xs font-extrabold tracking-wide text-[#6ee7b7] underline"
              >
                Submit another request
              </button>
            </div>
          ) : checkEmail ? (
            <div className="mt-6 rounded-2xl border border-[#34d399]/25 bg-[#34d399]/15 p-5 text-sm font-semibold text-[#6ee7b7]">
              Check your inbox for the confirmation link, then come back and sign in. You will be
              set up as the club owner automatically.
            </div>
          ) : (
            <form
              onSubmit={
                mode === "signin"
                  ? handleSignIn
                  : mode === "owner-setup"
                    ? handleOwnerSetup
                    : handleRequest
              }
              className="mt-6 space-y-4"
            >
              {mode === "request" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                        First name
                      </label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Amine"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                        Last name
                      </label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Benaissa"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      Department / role
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value as typeof department)}
                      className={inputClass}
                    >
                      {SUBMITTABLE_ADMIN_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {DEPARTMENT_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="you@wavez.dz"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0550 00 00 00"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="clay-md w-full rounded-2xl bg-[#2e6bff] px-6 py-3.5 font-bold text-white shadow-[0_16px_40px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                  >
                    {busy ? "Sending…" : "Send request for review"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("owner-setup")}
                    className="w-full text-xs font-bold text-muted-foreground"
                  >
                    Club owner? Set up your account
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="office@wavez.dz"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="clay-md w-full rounded-2xl bg-[#2e6bff] px-6 py-3.5 font-bold text-white shadow-[0_16px_40px_-16px_rgba(46,107,255,0.7)] disabled:opacity-70"
                  >
                    {busy ? "Please wait…" : mode === "signin" ? "Log in" : "Create account"}
                  </button>
                </>
              )}
            </form>
          )}

          {mode === "signin" && (
            <button
              onClick={() => switchMode("request")}
              className="mt-5 w-full text-sm font-bold text-brand-deep"
            >
              No account yet? Apply for a club role
            </button>
          )}
          {mode === "owner-setup" && (
            <button
              onClick={() => switchMode("signin")}
              className="mt-5 w-full text-sm font-bold text-brand-deep"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
