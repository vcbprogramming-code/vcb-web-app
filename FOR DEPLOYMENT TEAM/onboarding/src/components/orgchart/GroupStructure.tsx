import { GROUP_STRUCTURE } from "../../data/orgChart";

// Ported from the original app's Group Structure view (renderGroupStructureHtml,
// app.html) — Vichitbhan's position within the wider Vichitbhan Group: who
// owns it (Chavananand Family), sibling family-owned companies (VPO,
// Chavananand Holding — NOT part of VCB's own corporate structure, shown
// distinctly), and what VCB itself owns/co-owns (Subsidiaries, Joint
// Ventures). Connector lines are plain CSS borders here (see
// group-structure.css rules) instead of the original's measured DOM
// positions — see TreeNode.tsx's comment for why.
export function GroupStructure() {
  const { groupName, shareholders, parent, familyCompanies, subsidiaries, jvs } = GROUP_STRUCTURE;

  return (
    <div className="group-structure-frame">
      <div className="group-structure-label">{groupName}</div>

      <div className="group-shareholders">
        {shareholders.map((s) => (
          <div className="group-shareholder-box" key={s.id}>
            {s.label}
          </div>
        ))}
      </div>

      <div className="group-family-row">
        {familyCompanies.slice(0, Math.ceil(familyCompanies.length / 2)).map((c) => (
          <FamilyCompanyCard key={c.id} entity={c} />
        ))}

        <div className="group-entity-parent">
          <h3>{parent.label}</h3>
          <p>{parent.sub}</p>
        </div>

        {familyCompanies.slice(Math.ceil(familyCompanies.length / 2)).map((c) => (
          <FamilyCompanyCard key={c.id} entity={c} />
        ))}
      </div>

      <div className="group-structure-branches">
        <div className="group-branch">
          <div className="group-branch-label">Subsidiaries</div>
          <div className="group-entity-row">
            {subsidiaries.map((s) => (
              <div className="group-entity-card" key={s.id}>
                <h4>{s.label}</h4>
                <p>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="group-branch">
          <div className="group-branch-label">Joint Ventures</div>
          <div className="group-jv-row">
            {jvs.map((jv) => (
              <JvCard key={jv.id} jv={jv} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FamilyCompanyCard({ entity }: { entity: { id: string; label: string; sub: string } }) {
  return (
    <div className="group-family-hover">
      <div className="group-family-btn">{entity.label}</div>
      <div className="group-family-tooltip">{entity.sub}</div>
    </div>
  );
}

function JvCard({ jv }: { jv: { id: string; label: string; parents: string[] } }) {
  return (
    <div className="group-jv-card">
      <div className="group-jv-code">{jv.label}</div>
      <div className="group-jv-parents">{jv.parents.join(" & ")}</div>
    </div>
  );
}
