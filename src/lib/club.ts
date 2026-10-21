import { z } from "zod";

export const LEVELS = ["L1", "L2", "L3", "M1", "M2"] as const;
export type Level = (typeof LEVELS)[number];

export const SPECIALITIES = [
  "Systems",
  "Autonomous Systems",
  "Artificial Intelligence",
  "Telecommunications",
  "Electrotechnics",
  "Automatic Control",
] as const;

export const DEPARTMENTS = [
  "Systems, Autonomous and AI",
  "Telecommunications",
  "Electrotechnics",
  "Automatic Control",
] as const;

/**
 * Club roles say what a member does in the club — departments say where they
 * study. They are deliberately separate: a Telecommunications student can be
 * the Media Leader, and changing a department never changes a role.
 */
export const EXCLUSIVE_CLUB_ROLES = [
  "president",
  "vice_president",
  "hr_leader",
  "vice_hr_leader",
  "media_leader",
  "vice_media_leader",
  "dev_leader",
  "vice_dev_leader",
] as const;

export const MULTI_CLUB_ROLES = ["co_member", "media_member", "hr_member", "wavez_member"] as const;

export const CLUB_ROLES = [...EXCLUSIVE_CLUB_ROLES, ...MULTI_CLUB_ROLES] as const;

export type ClubRole = (typeof CLUB_ROLES)[number];

export const CLUB_ROLE_LABELS: Record<ClubRole, string> = {
  president: "President",
  vice_president: "Vice President",
  hr_leader: "HR Leader",
  vice_hr_leader: "Vice HR Leader",
  media_leader: "Media Leader",
  vice_media_leader: "Vice Media Leader",
  dev_leader: "Dev Leader",
  vice_dev_leader: "Vice Dev Leader",
  co_member: "Co-member",
  media_member: "Media Member",
  hr_member: "HR Member",
  wavez_member: "Wave-Z Member",
};

export function isClubRole(value: unknown): value is ClubRole {
  return typeof value === "string" && (CLUB_ROLES as readonly string[]).includes(value);
}

/**
 * The one-person roles. `members_exclusive_club_role_idx` (migration `0027`)
 * enforces singularity in the database; this is the app-side mirror used by
 * the pickers and the pre-insert checks.
 */
export function isExclusiveClubRole(role: ClubRole): boolean {
  return (EXCLUSIVE_CLUB_ROLES as readonly string[]).includes(role);
}

/**
 * Audiences for club-wide mail. "All members" includes people with no club
 * role yet; every other group is a role or team. Leadership is the eight
 * one-person roles, so a media leader appears under Leadership rather than
 * Media — the groups never overlap.
 */
export const MEMBER_AUDIENCE_VALUES = [
  "all",
  "leadership",
  "co_member",
  "media_member",
  "hr_member",
  "wavez_member",
] as const;

export type MemberAudience = (typeof MEMBER_AUDIENCE_VALUES)[number];

export const MEMBER_AUDIENCES: readonly {
  value: MemberAudience;
  label: string;
  roles: readonly ClubRole[];
}[] = [
  { value: "all", label: "All members", roles: [] },
  { value: "leadership", label: "Leadership members", roles: EXCLUSIVE_CLUB_ROLES },
  { value: "co_member", label: "Co-members", roles: ["co_member"] },
  { value: "media_member", label: "Media members", roles: ["media_member"] },
  { value: "hr_member", label: "HR members", roles: ["hr_member"] },
  { value: "wavez_member", label: "Wave-Z members", roles: ["wavez_member"] },
];

export function rolesForMemberAudience(audience: MemberAudience): readonly ClubRole[] {
  return MEMBER_AUDIENCES.find((option) => option.value === audience)?.roles ?? [];
}

export const memberSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  age: z.coerce.number().int().min(15, "Age must be 15 or more").max(99),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
  speciality: z.string().trim().min(2).max(80),
  level: z.enum(LEVELS),
  department: z.string().trim().min(2).max(80),
});

export type MemberInput = z.infer<typeof memberSchema>;

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
