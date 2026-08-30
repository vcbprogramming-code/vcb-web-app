import { Link, useParams } from "react-router-dom";
import { getDepartmentByLandingKey } from "../data/allDepartments";

// Ported from the original app's deptLanding() builder (content.html) —
// Meet Your Supervisor / Department Overview / Onboarding Phases.
export function DepartmentLanding() {
  const { pageKey: deptSlug } = useParams<{ pageKey: string }>();
  const dept = deptSlug ? getDepartmentByLandingKey(deptSlug) : undefined;

  if (!dept) {
    return (
      <div className="page">
        <h1>Department not found</h1>
        <Link to="/required-documents">Back to Department Selection</Link>
      </div>
    );
  }

  const { content } = dept;

  return (
    <div className="page">
      <h1>{content.title}</h1>

      <section className="content-section">
        <h2>Meet Your Supervisor</h2>
        <p>{content.supervisor}</p>
      </section>

      <section className="content-section">
        <h2>Department Overview</h2>
        {content.overview.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <ul>
          {content.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="footer-quote">{content.footerQuote}</p>
      </section>

      <section className="content-section">
        <h2>Workflow Within the Mango Anywhere ERP System</h2>
        {content.workflow.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section className="content-section">
        <h2>Onboarding Phases</h2>
        <div className="phase-grid">
          {content.phases.map((phase) => (
            <Link
              key={phase.dayRange}
              to={`/${dept.phasePrefix}-${phase.dayRange}`}
              className="phase-card"
            >
              {phase.page.eyebrow}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
