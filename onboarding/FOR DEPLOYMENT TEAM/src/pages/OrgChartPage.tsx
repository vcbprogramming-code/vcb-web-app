import { useState } from "react";
import { OrgChart } from "../components/orgchart/OrgChart";
import { GroupStructure } from "../components/orgchart/GroupStructure";

// Ported from the original app's "Company Structure" section, embedded on
// Home in the original (content.html's orgchart section, right below Our
// Track Record). Also routed at /company-structure here as a standalone
// page — the original had no separate route for it (it lived in-place on
// Home only) but a dedicated route makes it easier to link to directly
// during this port's development; nothing stops also embedding
// <OrgChartToggle /> directly on Home.tsx later if you want the original's
// exact single-page placement.
export function OrgChartPage() {
  const [view, setView] = useState<"chart" | "group">("chart");

  return (
    <div className="page">
      <h1>Company Structure</h1>
      <div className="org-view-toggle">
        <button type="button" className={view === "chart" ? "active" : ""} onClick={() => setView("chart")}>
          Org Chart
        </button>
        <button type="button" className={view === "group" ? "active" : ""} onClick={() => setView("group")}>
          Group Structure
        </button>
      </div>

      {view === "chart" ? (
        <>
          <p className="subheading">
            Click Leadership or any team to see who's in it, then click someone to see what they do.
          </p>
          <OrgChart />
        </>
      ) : (
        <>
          <p className="subheading">Vichitbhan's position relative to its subsidiaries and joint-venture partners.</p>
          <GroupStructure />
        </>
      )}
    </div>
  );
}
