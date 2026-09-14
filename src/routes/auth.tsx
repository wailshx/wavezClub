import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Wavez" },
      { name: "description", content: "Sign in to manage Wavez club members." },
      { property: "og:title", content: "Admin sign in — Wavez" },
      { property: "og:description", content: "Club officers sign in to the Wavez member console." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        setCheckEmail(true);
        return;
      }
      navigate({ to: "/admin" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/admin" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="clay-lg relative w-full max-w-md overflow-hidden rounded-3xl bg-card p-8">
        <div className="clay-sm animate-floaty absolute -top-8 -right-6 size-24 rounded-full bg-lemon" />
        <div className="relative">
          <Link to="/" className="text-xs font-extrabold tracking-wide text-brand-deep uppercase">
            ← Back to Wavez
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold">
            {mode === "signin" ? "Admin sign in" : "Create admin account"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Only club officers can manage members.
          </p>

          {checkEmail ? (
            <div className="clay-sm mt-6 rounded-2xl bg-mint/30 p-5 text-sm font-semibold text-mint-foreground">
              Check your inbox and click the confirmation link, then come back and sign in.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                className="clay-md w-full rounded-2xl bg-brand px-6 py-3.5 font-bold text-primary-foreground disabled:opacity-70"
              >
                {busy ? "Please wait…" : mode === "signin" ? "Log in" : "Create account"}
              </button>
            </form>
          )}

          <button
            onClick={() => {
              setCheckEmail(false);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            className="mt-5 w-full text-sm font-bold text-brand-deep"
          >
            {mode === "signin"
              ? "No account yet? Create the club admin account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
