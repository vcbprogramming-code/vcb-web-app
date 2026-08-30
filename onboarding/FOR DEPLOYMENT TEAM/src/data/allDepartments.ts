import { ACCOUNTING } from "./accounting";
import { FINANCE } from "./finance";
import { PROCUREMENT } from "./procurement";
import { PROPERTY } from "./property";
import { ENGINEERING } from "./engineering";
import type { DepartmentContent } from "./types";

// Single registry tying a department's landing-page key AND phase-page
// prefix together, since they don't always follow the same pattern —
// property-asset-management's landing key breaks the "<id>-team" pattern
// every other department uses (ported from the original app's DEPARTMENTS
// array in progress.html, which spells landingPage out explicitly for
// exactly this reason).
export interface DepartmentEntry {
  id: string;
  landingPageKey: string; // e.g. "finance-team", "property-asset-management"
  phasePrefix: string; // e.g. "finance", "property" — pageKey = `${phasePrefix}-${dayRange}`
  content: DepartmentContent;
}

export const ALL_DEPARTMENTS: DepartmentEntry[] = [
  { id: "accounting", landingPageKey: "accounting-team", phasePrefix: "accounting", content: ACCOUNTING },
  { id: "finance", landingPageKey: "finance-team", phasePrefix: "finance", content: FINANCE },
  { id: "procurement", landingPageKey: "procurement-team", phasePrefix: "procurement", content: PROCUREMENT },
  {
    id: "property",
    landingPageKey: "property-asset-management",
    phasePrefix: "property",
    content: PROPERTY,
  },
  { id: "engineering", landingPageKey: "engineering-team", phasePrefix: "engineering", content: ENGINEERING },
];

export function getDepartmentByLandingKey(landingKey: string): DepartmentEntry | undefined {
  return ALL_DEPARTMENTS.find((d) => d.landingPageKey === landingKey);
}

export function getDepartmentByPhasePrefix(prefix: string): DepartmentEntry | undefined {
  return ALL_DEPARTMENTS.find((d) => d.phasePrefix === prefix);
}
