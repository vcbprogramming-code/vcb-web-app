// Mirrors the content data model from the original app's content.html.
// A checklist item's `id` is permanent — never reuse or reassign one once
// employees may have completed it (see src/content.html's own ID-scheme
// comment in the original Apps Script app for the full rationale).

export type EmployeeLevel = "junior" | "senior";

export interface ChecklistItem {
  id: string;
  text: string;
  level?: EmployeeLevel; // undefined/omitted = visible to everyone
}

export interface ChecklistBlock {
  heading: string;
  items: ChecklistItem[];
  sub?: string;
}

export interface Department {
  id: string;
  label: string;
  shortLabel: string;
  prefix: string; // page-key namespace, e.g. "accounting-"
  landingPage: string;
  headOfDept: string;
}

export interface PhasePage {
  eyebrow: string;
  title: string;
  subtitle?: string;
  blocks: ChecklistBlock[];
  nextPhasePage?: string; // page key of the next phase, or undefined on the last phase
  closing?: string; // only set on the last phase (Day 61-90)
}

export interface DepartmentContent {
  eyebrow: string;
  title: string;
  supervisor: string;
  overview: string[];
  bullets: string[];
  footerQuote: string;
  workflow: string[];
  phases: {
    dayRange: "day-1-30" | "day-31-60" | "day-61-90";
    page: PhasePage;
  }[];
}

export interface RequiredDocument {
  id: string;
  title: string;
  action: string;
  desc: string;
  viewUrl?: string;
  downloadUrl?: string;
}
