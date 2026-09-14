import { z } from "zod";

export const LEVELS = ["L1", "L2", "L3", "M1", "M2"] as const;
export type Level = (typeof LEVELS)[number];

export const SPECIALITIES = [
  "Power Electronics",
  "Embedded Systems",
  "Telecom & Signals",
  "Control & Automation",
] as const;

export const DEPARTMENTS = [
  "Electrical Engineering",
  "Electronic Systems",
  "Automatic & Industrial Control",
  "Telecommunications",
] as const;

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
