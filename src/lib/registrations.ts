import { z } from "zod";
import { DEPARTMENTS, LEVELS } from "@/lib/club";

// Shared types + validation for campaigns, the public application form, and the
// admin editor. The public route is gone — the form renders inside the
// announcement card — but the campaign itself still carries the application's
// settings and the questions it asks.

/** Ceiling on custom questions per submission, enforced in the UI and on save. */
export const MAX_CUSTOM_QUESTIONS = 12;

/** Ceiling on options per multiple-choice question. */
export const MAX_QUESTION_OPTIONS = 8;

export type CampaignQuestionType = "text" | "choice";

/** What accepting a submission means: membership drive → Members row, event → participation only. */
export type CampaignKind = "membership" | "event";

/** A campaign question. `choice` questions carry `options`; `text` is a free answer. */
export type CampaignQuestion = {
  id: string;
  label: string;
  type: CampaignQuestionType;
  options?: string[];
};

/** Shape returned by the public `list_open_campaigns` RPC (open campaigns only). */
export type OpenCampaign = {
  id: string;
  title: string;
  description: string;
  custom_questions: CampaignQuestion[];
  kind: CampaignKind;
  created_at: string;
};

export const registrationBaseSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name").max(80),
  lastName: z.string().trim().min(2, "Enter your last name").max(80),
  department: z.enum(DEPARTMENTS, { message: "Select a department" }),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  schoolYear: z.enum(LEVELS, { message: "Select your school year" }),
});

export type RegistrationBaseInput = z.infer<typeof registrationBaseSchema>;

/** Build the answers sub-schema (keyed by question id) for a campaign's questions. */
export function buildAnswersSchema(questions: CampaignQuestion[]): z.ZodTypeAny {
  const fields: Record<string, z.ZodTypeAny> = {};
  for (const [index, question] of questions.entries()) {
    const label = question.label.trim();
    if (!label) continue;
    const key = question.id || `q${index}`;
    if (question.type === "choice") {
      const options = (question.options ?? []).map((option) => option.trim()).filter(Boolean);
      fields[key] =
        options.length > 0
          ? z.enum(options as [string, ...string[]], {
              message: `Select an option for "Question ${index + 1}"`,
            })
          : z.string().trim().min(1, "Answer this question").max(1000);
    } else {
      fields[key] = z.string().trim().min(1, "Answer this question").max(1000);
    }
  }
  return z.object(fields);
}
