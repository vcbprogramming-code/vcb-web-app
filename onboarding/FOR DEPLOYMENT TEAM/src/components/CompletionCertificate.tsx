import type { DepartmentEntry } from "../data/allDepartments";
import type { ChecklistItem } from "../data/types";

// Ported from the original app's buildCompletionCertificateHtml
// (progress.html) — a printable performance-review form. The original
// built this as a raw HTML string opened in a new window; here it's a
// real React component printed via window.print() on the current page
// (see CompletionPage.tsx), same visual structure: letterhead, meta info,
// one rated table per phase (Required Reading is deliberately excluded —
// see the original's own comment on why), then a page-2 "Attitude &
// Working Relationships" section with a fixed category list, ending in
// signature blocks.

const ATTITUDE_CATEGORIES = [
  "Attitude & Discipline",
  "Teamwork & Cooperation",
  "Communication",
  "Initiative & Ownership",
  "Reliability & Punctuality",
  "Adaptability",
];

function RatingDots() {
  return (
    <span className="cert-rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <span className="cert-rating-dot" key={n}>
          {n}
        </span>
      ))}
    </span>
  );
}

function isItemVisible(item: ChecklistItem, level: "junior" | "senior") {
  return item.level !== "senior" || level === "senior";
}

export function CompletionCertificate({
  name,
  dept,
  level,
}: {
  name: string;
  dept: DepartmentEntry;
  level: "junior" | "senior";
}) {
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="certificate">
      <header className="cert-letterhead">
        <div className="cert-letterhead-text">
          <div className="cert-company">Vichitbhan Construction Co., Ltd.</div>
          <div className="cert-company-sub">90-Day Onboarding — Completion Form</div>
        </div>
      </header>

      <div className="cert-meta">
        <div className="cert-meta-item">
          <span className="cert-meta-label">Employee</span>
          <span className="cert-meta-value">{name}</span>
        </div>
        <div className="cert-meta-item">
          <span className="cert-meta-label">Department</span>
          <span className="cert-meta-value">{dept.content.title}</span>
        </div>
        <div className="cert-meta-item">
          <span className="cert-meta-label">Track</span>
          <span className="cert-meta-value">{level === "senior" ? "Senior" : "Junior"}</span>
        </div>
        <div className="cert-meta-item">
          <span className="cert-meta-label">Date</span>
          <span className="cert-meta-value">{today}</span>
        </div>
      </div>

      {dept.content.phases.map((phase) => (
        <table className="cert-table" key={phase.dayRange}>
          <colgroup>
            <col />
            <col style={{ width: 220 }} />
          </colgroup>
          <tbody className="cert-phase-group">
            <tr className="cert-section-row">
              <td colSpan={2}>{phase.page.eyebrow}</td>
            </tr>
            {phase.page.blocks
              // Required Reading is left off the certificate entirely — see
              // the original's own reasoning: whether someone read the
              // material is already proven (or not) by whether they could
              // produce Required Outputs.
              .filter((block) => block.heading !== "Required Reading")
              .map((block) => (
                <>
                  <tr className="cert-subsection-row" key={`${block.heading}-header`}>
                    <td colSpan={2}>
                      <span className="cert-subsection-label">{block.heading}</span>
                      <span className="cert-rating-badge">RATING 1–5</span>
                    </td>
                  </tr>
                  {block.items
                    .filter((item) => isItemVisible(item, level))
                    .map((item) => (
                      <tr key={item.id}>
                        <td className={item.level === "senior" ? "cert-senior-task" : undefined}>
                          <span className="cert-check">✓</span>
                          {item.text}
                          {item.level === "senior" && <span className="cert-senior-badge">Senior</span>}
                        </td>
                        <td>
                          <RatingDots />
                        </td>
                      </tr>
                    ))}
                </>
              ))}
          </tbody>
        </table>
      ))}

      <div className="cert-page-break" />
      <h2 className="cert-page2-title">Attitude & Working Relationships</h2>
      <p className="cert-page2-sub">To be completed by the department head at the end of the 90-day period.</p>

      {ATTITUDE_CATEGORIES.map((cat) => (
        <div className="cert-attitude-row" key={cat}>
          <span>{cat}</span>
          <RatingDots />
        </div>
      ))}

      <div className="cert-comments-area" />

      <div className="cert-sign">
        <div className="cert-sign-block">
          <div className="cert-sign-line" />
          <div className="cert-sign-label">Employee signature — {name}</div>
        </div>
        <div className="cert-sign-block">
          <div className="cert-sign-line" />
          <div className="cert-sign-label">Department head signature — {dept.content.supervisor.split(" (")[0]}</div>
        </div>
      </div>

      <div className="cert-footer">Vichitbhan Construction Co., Ltd. — Internal Onboarding Portal</div>
    </div>
  );
}
