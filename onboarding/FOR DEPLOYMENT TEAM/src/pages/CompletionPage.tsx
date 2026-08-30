import { Link } from "react-router-dom";
import { useProgress } from "../lib/useProgress";
import { getDepartmentByLandingKey, ALL_DEPARTMENTS } from "../data/allDepartments";
import { CompletionCertificate } from "../components/CompletionCertificate";
import type { ChecklistItem } from "../data/types";

// Ported from the original app's PAGES['completion'] (content.html) — a
// real dedicated page, gated by isEmployeeOnboardingComplete() the same
// synchronous way every other access-gated page in the original app
// works (see the original's docs/ARCHITECTURE.md "Completion page"
// section for the full history of why this replaced an earlier in-place
// "gated reveal" mechanism). Shows the two feature cards (Meet Our Team /
// Life on Site) if — and only if — every phase in the employee's
// department is fully complete; otherwise a "not finished yet" message,
// same as the original.

function isItemVisible(item: ChecklistItem, level: "junior" | "senior") {
  return item.level !== "senior" || level === "senior";
}

export function CompletionPage() {
  const { name, department, level, loaded, isTaskDone } = useProgress();

  if (!loaded) return <div className="page">Loading…</div>;

  const dept = department
    ? ALL_DEPARTMENTS.find((d) => d.id === department)
    : undefined;

  const complete =
    !!name &&
    !!dept &&
    dept.content.phases.every((phase) =>
      phase.page.blocks
        .flatMap((b) => b.items)
        .filter((item) => isItemVisible(item, level))
        .every((item) => isTaskDone(item.id)),
    );

  if (!complete || !dept) {
    return (
      <div className="page">
        <h1>Not finished yet</h1>
        <p>This page unlocks once every checklist item across all three phases of your department is complete.</p>
        <Link to="/required-documents" className="cta">
          Return to your checklist
        </Link>
      </div>
    );
  }

  const landingDept = getDepartmentByLandingKey(dept.landingPageKey);

  return (
    <div className="page no-print">
      <p className="eyebrow">Onboarding Complete</p>
      <h1>Welcome, officially, to the team!</h1>

      <div className="feature-grid">
        <div className="feature-tile">
          <h3>Meet Our Team</h3>
          <p>
            Explore the infrastructure works that define our execution standards. Each project
            reflects coordination, discipline, and long-term durability.
          </p>
        </div>
        <div className="feature-tile">
          <h3>Check Out Life on Site</h3>
          <p>
            From early morning briefings to milestone handovers, our teams operate in dynamic
            environments where teamwork and structure drive results.
          </p>
        </div>
      </div>

      <div className="external-cta-row">
        <button type="button" className="cta secondary" onClick={() => window.print()}>
          Print Completion Form
        </button>
      </div>

      {landingDept && (
        <div className="print-only">
          <CompletionCertificate name={name!} dept={landingDept} level={level} />
        </div>
      )}
    </div>
  );
}
