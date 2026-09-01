import { Link, Outlet } from "react-router-dom";
import { ALL_DEPARTMENTS } from "../data/allDepartments";
import { useTheme } from "../lib/useTheme";
import { useT } from "../lib/LangContext";

// Ported (partial) from the original app's sidebar shell (Index.html/
// app.html) — brand, nav, theme + language toggle. The full journey
// stepper (Pre-boarding → ... → Completion with done/current/locked
// states, see getJourneySteps in the original progress.html) is NOT
// ported — this is a plain static nav list instead.
export function Layout() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useT();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-name">VCB ONBOARDING</span>
          <span className="brand-sub">{t("Vichitbhan Construction Co., Ltd.")}</span>
        </Link>
        <nav>
          <Link to="/">{t("Home")}</Link>
          <Link to="/required-documents">{t("Required Documents")}</Link>
          {ALL_DEPARTMENTS.map((dept) => (
            <Link key={dept.id} to={`/${dept.landingPageKey}`}>
              {t(dept.content.title)}
            </Link>
          ))}
          <Link to="/completion">{t("Completion")}</Link>
          <Link to="/company-structure">{t("Company Structure")}</Link>
        </nav>

        <div className="sidebar-settings">
          <div className="settings-row">
            <button type="button" className={theme !== "dark" ? "active" : ""} onClick={() => setTheme("light")}>
              {t("Light")}
            </button>
            <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
              {t("Dark")}
            </button>
          </div>
          <div className="settings-row">
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
              EN
            </button>
            <button type="button" className={lang === "th" ? "active" : ""} onClick={() => setLang("th")}>
              ไทย
            </button>
          </div>
          <Link to="/admin" className="admin-link">
            {t("Admin")}
          </Link>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
