/**
 * Template interpolation shared by the Emails admin page and the server
 * function that actually sends: the live preview must render exactly what the
 * server will send, so both go through this one module.
 *
 * Tokens are `{{ name }}` in any case with optional inner spaces, matching the
 * CSV-based scripts in `email-templates/`. Unknown tokens are left untouched
 * so a typo shows up in the preview instead of silently disappearing.
 */
export type EmailTemplateContact = {
  /** Full name — what `{{name}}` renders. */
  name: string;
  first_name: string;
  last_name: string;
  email: string;
};

export const EMAIL_TEMPLATE_TOKENS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{name}}", label: "Full name" },
  { token: "{{email}}", label: "Email" },
  { token: "{{logo_url}}", label: "Logo URL" },
] as const;

const TOKEN_PATTERN = /\{\{\s*(first_name|last_name|name|email|logo_url)\s*\}\}/gi;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/**
 * Replace the template's tokens for one recipient.
 *
 * `escape` is true for HTML bodies (a name like `O'Brien` must not break the
 * markup) and false for subjects and plain-text bodies, where entities would
 * arrive literally.
 */
export function renderEmailTemplate(
  template: string,
  contact: EmailTemplateContact,
  options: { escape: boolean; logoUrl: string },
): string {
  return template.replace(TOKEN_PATTERN, (_match, key: string) => {
    const value =
      key.toLowerCase() === "logo_url"
        ? options.logoUrl
        : ((contact[key.toLowerCase() as keyof EmailTemplateContact] as string | undefined) ?? "");
    return options.escape ? escapeHtml(value) : value;
  });
}

/** Split a stored `full_name` into the first/rest pair the tokens expose. */
export function splitContactName(fullName: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
}
