import { useEffect, useState } from "react";
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

const labelClass = "text-xs font-extrabold uppercase tracking-wide text-brand-deep/80";
const inputClass =
  "clay-sm mt-1.5 w-full rounded-2xl bg-background px-4 py-3 font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-brand";

const MAX_DOC_BYTES = 5 * 1024 * 1024;
const ACCEPT_SCHOOL = "application/pdf,image/png,image/jpeg,image/webp";
const ACCEPT_IDENTITY = "image/png,image/jpeg,image/webp";

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

async function insertRegistration(
  campaign: OpenCampaign,
  payload: {
    profile: ProfileState;
    answers: Record<string, string>;
    school_certificate_url?: string | null;
    identity_card_url?: string | null;
  },
) {
  const db = supabase as unknown as {
    from: (table: string) => {
      insert: (row: object) => Promise<{ error: { message: string } | null }>;
    };
  };
  return db.from("registrations").insert({
    campaign_id: campaign.id,
    first_name: payload.profile.firstName,
    last_name: payload.profile.lastName,
    department: payload.profile.department,
    email: payload.profile.email.toLowerCase(),
    phone: payload.profile.phone,
    school_year: payload.profile.schoolYear,
    answers: payload.answers,
    ...(payload.school_certificate_url
      ? { school_certificate_url: payload.school_certificate_url }
      : {}),
    ...(payload.identity_card_url ? { identity_card_url: payload.identity_card_url } : {}),
  });
}

/**
 * The public application form, rendered *inside* an announcement card.
 *
 * The campaign decides the shape: `event` campaigns get the single-step details
 * form, `membership` campaigns get the 3-step wizard with the two document
 * uploads. It writes straight into `registrations` through the anon client —
 * RLS only accepts the insert while the campaign is open.
 */
export function SubmissionApplicationForm({
  campaign,
  onClose,
}: {
  campaign: OpenCampaign;
  onClose: () => void;
}) {
  return campaign.kind === "event" ? (
    <EventForm campaign={campaign} onClose={onClose} />
  ) : (
    <MembershipWizard campaign={campaign} onClose={onClose} />
  );
}

// ─── Event campaigns: single-step details form ─────────────────────────────

function EventForm({ campaign, onClose }: { campaign: OpenCampaign; onClose: () => void }) {
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
    const { error } = await insertRegistration(campaign, {
      profile: parsed.data,
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

  if (done) {
    return (
      <SuccessPanel
        title="Thanks — you're in the list!"
        body={
          <>
            You're confirmed for <span className="font-extrabold">{campaign.title}</span>. The club
            team will email you the event details — no membership needed.
          </>
        }
        onClose={onClose}
        onAgain={() => setDone(false)}
        againLabel="Apply again"
      />
    );
  }

  return (
    <div className="rounded-3xl border border-foreground/10 bg-background/70 p-5 md:p-6">
      <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
        Event sign-up
      </p>
      {campaign.description && (
        <p className="mt-1.5 text-sm font-semibold text-foreground/75">{campaign.description}</p>
      )}

      {formError && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-300 bg-red-100/70 px-4 py-3 text-sm font-bold text-red-700"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="firstName">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            maxLength={80}
            placeholder="Yasmine"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lastName">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            maxLength={80}
            placeholder="Boudiaf"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="department">
            Department
          </label>
          <select id="department" name="department" className={inputClass}>
            {DEPARTMENTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="schoolYear">
            School year
          </label>
          <select id="schoolYear" name="schoolYear" className={inputClass}>
            {LEVELS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={255}
            placeholder="yasmine@univ-sba.dz"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            maxLength={30}
            placeholder="0550 12 34 56"
            className={inputClass}
          />
        </div>

        {campaign.custom_questions.map((question: CampaignQuestion) => (
          <div key={question.id} className="md:col-span-2">
            <label className={labelClass} htmlFor={`answer_${question.id}`}>
              {question.label}
            </label>
            {question.type === "choice" ? (
              <select
                id={`answer_${question.id}`}
                name={`answer_${question.id}`}
                className={inputClass}
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
                className={inputClass}
              />
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="clay-md rounded-2xl bg-brand px-8 py-3.5 font-extrabold text-primary-foreground disabled:opacity-70"
          >
            {busy ? "Sending…" : "Send my application"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="clay-sm rounded-2xl bg-card px-6 py-3.5 font-bold text-brand-deep"
          >
            Cancel
          </button>
        </div>
      </form>
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
                    ? "border-brand bg-brand text-white shadow-[0_6px_18px_-8px_rgba(37,99,235,0.7)]"
                    : "border-[#c3cbd9] bg-background text-[#64748b]"
                }`}
              >
                {complete ? <Check className="size-4" aria-hidden="true" /> : step}
              </span>
              {index < STEP_LABELS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-0.5 flex-1 rounded-full ${complete ? "bg-brand" : "bg-[#dfe5ee]"}`}
                />
              )}
            </span>
            <span
              className={`mt-2 text-xs font-extrabold tracking-wide uppercase ${
                active || complete ? "text-brand" : "text-[#64748b]"
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
        <div className="mt-1.5 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 px-3 py-2.5">
          {isImage && doc.preview ? (
            <img
              src={doc.preview}
              alt={`${titleLabel} preview`}
              className="size-14 shrink-0 rounded-xl border border-brand/20 object-cover"
            />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
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
          className={`mt-1.5 flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#c3cbd9] bg-background px-4 py-6 text-center transition-colors hover:border-brand/50 hover:bg-brand/5`}
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

function MembershipWizard({ campaign, onClose }: { campaign: OpenCampaign; onClose: () => void }) {
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

  // Cards mount and unmount as they are opened and closed, so the object URLs
  // backing the document previews have to be released with them.
  useEffect(() => {
    const previews = [schoolDoc?.preview, identityDoc?.preview].filter(
      (value): value is string => typeof value === "string",
    );
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, [schoolDoc, identityDoc]);

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

  function reset() {
    setDone(false);
    setStep(1);
    setProfile(blankProfile);
    setSchoolDoc(null);
    setIdentityDoc(null);
    setAnswers(buildInitialAnswers(campaign));
    setFormError(null);
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

    const { error } = await insertRegistration(campaign, {
      profile: parsed.data,
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
      <SuccessPanel
        title="Thanks — you're in the list!"
        body={
          <>
            Your submission for <span className="font-extrabold">{campaign.title}</span> has been
            received. The club team will review your profile and documents, then contact you by
            email.
          </>
        }
        onClose={onClose}
        onAgain={reset}
        againLabel="Apply again"
      />
    );
  }

  return (
    <div className="rounded-3xl border border-foreground/10 bg-background/70 p-5 md:p-6">
      <p className="text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
        Membership application
      </p>
      {campaign.description && (
        <p className="mt-1.5 text-sm font-semibold text-foreground/75">{campaign.description}</p>
      )}

      <div className="mt-5">
        <Stepper current={step} />
      </div>

      {formError && (
        <div className="mt-5">
          <AlertBanner variant="error" title="Error" onDismiss={() => setFormError(null)}>
            {formError}
          </AlertBanner>
        </div>
      )}

      {step === 1 && (
        <section
          aria-label="Step 1 — Profile"
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
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
        <section aria-label="Step 2 — Documents" className="mt-6 grid grid-cols-1 gap-4">
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
        <section aria-label="Step 3 — Questions" className="mt-6 grid grid-cols-1 gap-4">
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

          {uploadStep !== "none" && (
            <div className="rounded-2xl border border-brand/30 bg-brand/5 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-bold text-brand-deep">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {uploadStep === "school" ? "Uploading school certificate…" : "Uploading ID card…"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe5ee]">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(current - 1, 1))}
          disabled={step === 1 || busy}
          className="clay-sm rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="clay-sm rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep disabled:opacity-50"
          >
            Cancel
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || busy}
              className="clay-md rounded-2xl bg-brand px-8 py-3 font-extrabold text-primary-foreground disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!step3Valid || busy}
              className="clay-md inline-flex items-center gap-2 rounded-2xl bg-brand px-8 py-3 font-extrabold text-primary-foreground disabled:opacity-50"
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
    </div>
  );
}

function SuccessPanel({
  title,
  body,
  onClose,
  onAgain,
  againLabel,
}: {
  title: string;
  body: React.ReactNode;
  onClose: () => void;
  onAgain: () => void;
  againLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-brand/20 bg-brand/5 p-5 md:p-6">
      <AlertBanner variant="success" title="Success" onDismiss={onAgain}>
        {title}
      </AlertBanner>
      <span className="mt-5 inline-flex items-center rounded-full bg-mint/25 px-4 py-1.5 text-xs font-extrabold text-mint-foreground">
        Application received
      </span>
      <h3 className="mt-3 font-display text-2xl font-bold text-brand-deep">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-foreground/75">{body}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onClose}
          className="clay-md rounded-2xl bg-brand px-6 py-3 font-bold text-primary-foreground"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onAgain}
          className="clay-sm rounded-2xl bg-card px-6 py-3 font-bold text-brand-deep"
        >
          {againLabel}
        </button>
      </div>
    </div>
  );
}
