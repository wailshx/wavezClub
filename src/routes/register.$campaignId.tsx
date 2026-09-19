import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, FileText, Loader2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS, LEVELS } from "@/lib/club";
import {
  buildAnswersSchema,
  registrationBaseSchema,
  type CampaignQuestion,
  type OpenCampaign,
} from "@/lib/registrations";
import { AlertBanner } from "@/components/alert-banner";
import logo from "@/assets/wavez-logo.png";

export const Route = createFileRoute("/register/$campaignId")({
  component: RegisterCampaign,
});

const labelClass = "text-xs font-extrabold uppercase tracking-wide text-brand-deep/80";
const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand";

const MAX_DOC_BYTES = 5 * 1024 * 1024;
const ACCEPT_SCHOOL = "application/pdf,image/png,image/jpeg,image/webp";
const ACCEPT_IDENTITY = "image/png,image/jpeg,image/webp";

type RpcResult = { data: unknown; error: { message: string } | null };

type ProfileState = {
  firstName: string;
  lastName: string;
  department: string;
  schoolYear: string;
  email: string;
  phone: string;
};

type DocDraft = {
  file: File;
  preview: string | null;
};

const blankProfile: ProfileState = {
  firstName: "",
  lastName: "",
  department: DEPARTMENTS[0] ?? "",
  schoolYear: LEVELS[0] ?? "",
  email: "",
  phone: "",
};

function buildInitialAnswers(campaign: OpenCampaign): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const question of campaign.custom_questions) {
    answers[question.id] = question.type === "choice" ? (question.options?.[0] ?? "") : "";
  }
  return answers;
}

function RegisterCampaign() {
  const params = useParams({ from: "/register/$campaignId" });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["open-campaign", params.campaignId],
    queryFn: async () => {
      const rpc = supabase as unknown as { rpc: (fn: string) => Promise<RpcResult> };
      const { data, error } = await rpc.rpc("list_open_campaigns");
      if (error) throw error;
      const list = (data ?? []) as OpenCampaign[];
      return list.find((item) => item.id === params.campaignId) ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="font-semibold text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="hero-glass max-w-md rounded-4xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-brand-deep">
            This registration has closed
          </h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            The campaign isn't open right now — check the home page for other open registrations.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="clay-md inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-6xl px-5 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Wavez Club logo" width={64} height={64} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-none font-bold text-brand-deep">
                Wavez
              </p>
              <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground">
                Club · Register
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="clay-sm rounded-2xl bg-card px-5 py-2.5 text-sm font-bold text-brand-deep"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 md:py-14">
        {campaign.kind === "event" ? (
          <EventForm campaign={campaign} />
        ) : (
          <MembershipWizard campaign={campaign} />
        )}
      </main>
    </div>
  );
}

// ─── Event campaigns: existing single-step form (unchanged) ─────────────────

const eventLabelClass = "text-xs font-extrabold uppercase tracking-wide text-brand-deep/80";
const eventInputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand";

function EventForm({ campaign }: { campaign: OpenCampaign }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));

    const answers: Record<string, string> = {};
    for (const question of campaign.custom_questions) {
      const value = raw[`answer_${question.id}`];
      if (typeof value === "string" && value.trim() !== "") answers[question.id] = value.trim();
    }

    const parsed = registrationBaseSchema
      .extend({ answers: buildAnswersSchema(campaign.custom_questions) })
      .safeParse({ ...raw, answers });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Please check your answers";
      setFormError(message);
      toast.error(message);
      return;
    }

    setBusy(true);
    setFormError(null);
    const db = supabase as unknown as {
      from: (table: string) => {
        insert: (row: object) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await db.from("registrations").insert({
      campaign_id: campaign.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      department: parsed.data.department,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      school_year: parsed.data.schoolYear,
      answers: parsed.data.answers,
    });
    setBusy(false);

    if (error) {
      setFormError(error.message);
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("You're confirmed for the event!");
  }

  return (
    <div className="hero-glass rounded-4xl p-8 md:p-12">
      {done ? (
        <>
          <span className="inline-flex items-center rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
            Application received
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-brand-deep md:text-4xl">
            Thanks — you're in the list!
          </h1>
          <p className="mt-3 font-semibold text-foreground/75">
            You're confirmed for <span className="font-extrabold">{campaign.title}</span>. The club
            team will email you the event details — no membership needed.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/"
              className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground"
            >
              Back to home
            </Link>
            <button
              onClick={() => setDone(false)}
              className="clay-sm rounded-2xl bg-card px-7 py-3.5 font-bold text-brand-deep"
            >
              Apply again
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="inline-flex items-center rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
            Open registration
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-brand-deep md:text-4xl">
            {campaign.title}
          </h1>
          {campaign.description && (
            <p className="mt-3 font-semibold text-foreground/75">{campaign.description}</p>
          )}

          {formError && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-red-300 bg-red-100/70 px-4 py-3 text-sm font-bold text-red-700"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={eventLabelClass} htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                maxLength={80}
                placeholder="Yasmine"
                className={eventInputClass}
              />
            </div>
            <div>
              <label className={eventLabelClass} htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                required
                maxLength={80}
                placeholder="Boudiaf"
                className={eventInputClass}
              />
            </div>
            <div>
              <label className={eventLabelClass} htmlFor="department">
                Department
              </label>
              <select id="department" name="department" className={eventInputClass}>
                {DEPARTMENTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={eventLabelClass} htmlFor="schoolYear">
                School year
              </label>
              <select id="schoolYear" name="schoolYear" className={eventInputClass}>
                {LEVELS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={eventLabelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
                placeholder="yasmine@univ-sba.dz"
                className={eventInputClass}
              />
            </div>
            <div>
              <label className={eventLabelClass} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                maxLength={30}
                placeholder="0550 12 34 56"
                className={eventInputClass}
              />
            </div>

            {campaign.custom_questions.map((question: CampaignQuestion) => (
              <div key={question.id} className="md:col-span-2">
                <label className={eventLabelClass} htmlFor={`answer_${question.id}`}>
                  {question.label}
                </label>
                {question.type === "choice" ? (
                  <select
                    id={`answer_${question.id}`}
                    name={`answer_${question.id}`}
                    className={eventInputClass}
                  >
                    {(question.options ?? []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    id={`answer_${question.id}`}
                    name={`answer_${question.id}`}
                    required
                    rows={3}
                    maxLength={1000}
                    placeholder="Your answer"
                    className={eventInputClass}
                  />
                )}
              </div>
            ))}

            <div className="mt-2 md:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="clay-md w-full rounded-2xl bg-brand px-8 py-3.5 font-extrabold text-primary-foreground disabled:opacity-70"
              >
                {busy ? "Sending…" : "Send my application"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

// ─── Membership campaigns: 3-step wizard ────────────────────────────────────

const STEP_LABELS = ["Profile", "Documents", "Questions"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex">
      {STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const complete = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center">
            <span className="flex w-full items-center">
              <span
                aria-current={active ? "step" : undefined}
                className={`grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold transition-colors ${
                  complete || active
                    ? "border-[#2e6bff] bg-[#2e6bff] text-white shadow-[0_6px_18px_-8px_rgba(46,107,255,0.7)]"
                    : "border-[#c3cbd9] bg-background text-[#64748b]"
                }`}
              >
                {complete ? <Check className="size-4" aria-hidden="true" /> : step}
              </span>
              {index < STEP_LABELS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-0.5 flex-1 rounded-full ${complete ? "bg-[#2e6bff]" : "bg-[#dfe5ee]"}`}
                />
              )}
            </span>
            <span
              className={`mt-2 text-xs font-extrabold tracking-wide uppercase ${
                active || complete ? "text-[#2e6bff]" : "text-[#64748b]"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DocField({
  titleLabel,
  acceptLabel,
  accept,
  fileHint,
  doc,
  error,
  onPick,
  onClear,
}: {
  titleLabel: string;
  acceptLabel: string;
  accept: string;
  fileHint: string;
  doc: DocDraft | null;
  error: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const isImage = doc ? doc.file.type.startsWith("image/") : false;

  return (
    <div>
      <label className={labelClass} htmlFor={titleLabel}>
        {titleLabel} <span className="text-[#ef4444]">*</span>
      </label>
      {doc ? (
        <div className="mt-1.5 flex items-center gap-3 rounded-2xl border border-[#2e6bff]/30 bg-[#2e6bff]/5 px-3 py-2.5">
          {isImage && doc.preview ? (
            <img
              src={doc.preview}
              alt={`${titleLabel} preview`}
              className="size-14 shrink-0 rounded-xl border border-[#2e6bff]/20 object-cover"
            />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#2e6bff]/10 text-[#2e6bff]">
              <FileText className="size-6" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-brand-deep">{doc.file.name}</p>
            <p className="text-xs font-semibold text-muted-foreground">
              {(doc.file.size / 1024 / 1024).toFixed(2)} MB — ready for submission
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${titleLabel}`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-[#ef4444]"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          className={`mt-1.5 flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#c3cbd9] bg-background px-4 py-6 text-center transition-colors hover:border-[#2e6bff]/50 hover:bg-[#2e6bff]/5`}
        >
          <span className="text-sm font-bold text-brand-deep">Click to choose a file</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {acceptLabel} · max 5 MB
          </span>
          <input
            id={titleLabel}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
              event.target.value = "";
            }}
          />
        </label>
      )}
      {fileHint && <p className="mt-1 text-xs font-semibold text-muted-foreground">{fileHint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-bold text-[#ef4444]">
          {error}
        </p>
      )}
    </div>
  );
}

function MembershipWizard({ campaign }: { campaign: OpenCampaign }) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<"none" | "school" | "identity">("none");
  const [profile, setProfile] = useState<ProfileState>(blankProfile);
  const [schoolDoc, setSchoolDoc] = useState<DocDraft | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [identityDoc, setIdentityDoc] = useState<DocDraft | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    buildInitialAnswers(campaign),
  );

  const step1Valid = registrationBaseSchema.safeParse(profile).success;
  const step2Valid = Boolean(schoolDoc && identityDoc && !schoolError && !identityError);
  const step3Valid =
    campaign.custom_questions.length === 0 ||
    campaign.custom_questions.every((question) => (answers[question.id] ?? "").trim() !== "");

  function setProfileField(field: keyof ProfileState, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function pickDoc(file: File, kind: "school" | "identity") {
    if (kind === "school") {
      setSchoolError(null);
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(file.type)) {
        setSchoolError("School certificate must be a PDF, JPG or PNG image.");
        return;
      }
      if (file.size > MAX_DOC_BYTES) {
        setSchoolError("School certificate must be under 5 MB.");
        return;
      }
      setSchoolDoc({
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    } else {
      setIdentityError(null);
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(file.type)) {
        setIdentityError("ID card must be a JPG or PNG image.");
        return;
      }
      if (file.size > MAX_DOC_BYTES) {
        setIdentityError("ID card must be under 5 MB.");
        return;
      }
      setIdentityDoc({ file, preview: URL.createObjectURL(file) });
    }
  }

  function clearDoc(kind: "school" | "identity") {
    if (kind === "school") setSchoolDoc(null);
    else setIdentityDoc(null);
  }

  async function uploadDoc(file: File, label: string, readonlyLabel: string): Promise<string> {
    const ext =
      file.name.split(".").pop()?.toLowerCase() ||
      (file.type === "application/pdf" ? "pdf" : "jpg");
    const path = `registration/${crypto.randomUUID()}/${label}.${ext}`;
    const { error } = await supabase.storage
      .from("identity-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      throw new Error(`Couldn't upload your ${readonlyLabel}. ${error.message}`);
    }
    return path;
  }

  async function handleSubmit() {
    if (!schoolDoc || !identityDoc) {
      setFormError("Please attach both documents on the Documents step.");
      return;
    }
    setBusy(true);
    setFormError(null);

    const parsed = registrationBaseSchema
      .extend({ answers: buildAnswersSchema(campaign.custom_questions) })
      .safeParse({ ...profile, answers });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Please check your answers");
      setBusy(false);
      return;
    }

    let schoolPath: string | null = null;
    let identityPath: string | null = null;
    try {
      setUploadStep("school");
      schoolPath = await uploadDoc(schoolDoc.file, "school-certificate", "school certificate");
      setUploadStep("identity");
      identityPath = await uploadDoc(identityDoc.file, "identity-card", "ID card");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Document upload failed — please try again.",
      );
      setUploadStep("none");
      setBusy(false);
      return;
    }
    setUploadStep("none");

    const db = supabase as unknown as {
      from: (table: string) => {
        insert: (row: object) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await db.from("registrations").insert({
      campaign_id: campaign.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      department: parsed.data.department,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      school_year: parsed.data.schoolYear,
      answers: parsed.data.answers,
      school_certificate_url: schoolPath,
      identity_card_url: identityPath,
    });
    setBusy(false);

    if (error) {
      setFormError(error.message);
      return;
    }
    setDone(true);
    toast.success("Application sent! We'll contact you soon.");
  }

  if (done) {
    return (
      <div className="hero-glass rounded-4xl p-8 md:p-12">
        <AlertBanner variant="success" title="Success" onDismiss={() => setDone(false)}>
          Your registration has been submitted successfully and we've received your documents.
        </AlertBanner>
        <span className="mt-6 inline-flex items-center rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
          Application received
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-brand-deep md:text-4xl">
          Thanks — you're in the list!
        </h1>
        <p className="mt-3 font-semibold text-foreground/75">
          Your submission for <span className="font-extrabold">{campaign.title}</span> has been
          received. The club team will review your profile and documents, then contact you by email.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/"
            className="clay-md rounded-2xl bg-brand px-7 py-3.5 font-bold text-primary-foreground"
          >
            Back to home
          </Link>
          <button
            onClick={() => {
              setDone(false);
              setStep(1);
              setProfile(blankProfile);
              setSchoolDoc(null);
              setIdentityDoc(null);
              setAnswers(buildInitialAnswers(campaign));
              setFormError(null);
            }}
            className="clay-sm rounded-2xl bg-card px-7 py-3.5 font-bold text-brand-deep"
          >
            Apply again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-glass rounded-4xl p-8 md:p-12">
      <span className="inline-flex items-center rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
        Open registration
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold text-brand-deep md:text-4xl">
        {campaign.title}
      </h1>
      {campaign.description && (
        <p className="mt-3 font-semibold text-foreground/75">{campaign.description}</p>
      )}

      <div className="mt-8">
        <Stepper current={step} />
      </div>

      {formError && (
        <div className="mt-6">
          <AlertBanner variant="error" title="Error" onDismiss={() => setFormError(null)}>
            {formError}
          </AlertBanner>
        </div>
      )}

      {step === 1 && (
        <section
          aria-label="Step 1 — Profile"
          className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div>
            <label className={labelClass} htmlFor="w-firstName">
              First name
            </label>
            <input
              id="w-firstName"
              required
              maxLength={80}
              placeholder="Yasmine"
              className={inputClass}
              value={profile.firstName}
              onChange={(e) => setProfileField("firstName", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="w-lastName">
              Last name
            </label>
            <input
              id="w-lastName"
              required
              maxLength={80}
              placeholder="Boudiaf"
              className={inputClass}
              value={profile.lastName}
              onChange={(e) => setProfileField("lastName", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="w-department">
              Department
            </label>
            <select
              id="w-department"
              className={inputClass}
              value={profile.department}
              onChange={(e) => setProfileField("department", e.target.value)}
            >
              {DEPARTMENTS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="w-schoolYear">
              School year
            </label>
            <select
              id="w-schoolYear"
              className={inputClass}
              value={profile.schoolYear}
              onChange={(e) => setProfileField("schoolYear", e.target.value)}
            >
              {LEVELS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="w-email">
              Email
            </label>
            <input
              id="w-email"
              type="email"
              required
              maxLength={255}
              placeholder="yasmine@univ-sba.dz"
              className={inputClass}
              value={profile.email}
              onChange={(e) => setProfileField("email", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="w-phone">
              Phone
            </label>
            <input
              id="w-phone"
              type="tel"
              required
              maxLength={30}
              placeholder="0550 12 34 56"
              className={inputClass}
              value={profile.phone}
              onChange={(e) => setProfileField("phone", e.target.value)}
            />
          </div>
          <p className="text-xs font-semibold text-muted-foreground md:col-span-2">
            We need these details to check your eligibility and contact you. Next stays disabled
            until this section is valid.
          </p>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Step 2 — Documents" className="mt-8 grid grid-cols-1 gap-4">
          <DocField
            titleLabel="School certificate"
            acceptLabel="PDF, JPG or PNG"
            accept={ACCEPT_SCHOOL}
            fileHint="Proof of enrolment — PDF, JPG or PNG, max 5 MB."
            doc={schoolDoc}
            error={schoolError}
            onPick={(file) => pickDoc(file, "school")}
            onClear={() => clearDoc("school")}
          />
          <DocField
            titleLabel="Identity card"
            acceptLabel="JPG or PNG"
            accept={ACCEPT_IDENTITY}
            fileHint="A photo of your national ID card — JPG or PNG, max 5 MB."
            doc={identityDoc}
            error={identityError}
            onPick={(file) => pickDoc(file, "identity")}
            onClear={() => clearDoc("identity")}
          />
          <p className="text-xs font-semibold text-muted-foreground">
            Both files are uploaded securely when you hit Submit — they are never stored publicly
            and are only viewed by the club officers.
          </p>
        </section>
      )}

      {step === 3 && (
        <section aria-label="Step 3 — Questions" className="mt-8 grid grid-cols-1 gap-4">
          {campaign.custom_questions.length === 0 ? (
            <p className="font-semibold text-muted-foreground">
              No extra questions for this campaign — review your details and submit.
            </p>
          ) : (
            campaign.custom_questions.map((question: CampaignQuestion) => (
              <div key={question.id} className="md:col-span-2">
                <label className={labelClass} htmlFor={`w-answer_${question.id}`}>
                  {question.label}
                </label>
                {question.type === "choice" ? (
                  <select
                    id={`w-answer_${question.id}`}
                    className={inputClass}
                    value={answers[question.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                    }
                  >
                    {(question.options ?? []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    id={`w-answer_${question.id}`}
                    required
                    rows={3}
                    maxLength={1000}
                    placeholder="Your answer"
                    className={inputClass}
                    value={answers[question.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))
          )}

          {step === 3 && uploadStep !== "none" && (
            <div className="rounded-2xl border border-[#2e6bff]/30 bg-[#2e6bff]/5 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-bold text-brand-deep">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {uploadStep === "school" ? "Uploading school certificate…" : "Uploading ID card…"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe5ee]">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2e6bff]" />
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(current - 1, 1))}
          disabled={step === 1 || busy}
          className="clay-sm rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep disabled:opacity-50"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || busy}
            className="clay-md rounded-2xl bg-brand px-8 py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!step3Valid || busy}
            className="clay-md inline-flex items-center gap-2 rounded-2xl bg-brand px-8 py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Submitting…
              </>
            ) : (
              <>
                <Check className="size-4" aria-hidden="true" />
                Submit application
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
