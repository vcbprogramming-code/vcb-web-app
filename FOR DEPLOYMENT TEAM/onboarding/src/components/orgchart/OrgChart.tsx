import { LEADERSHIP, DEPARTMENTS_ORG, ADMINISTRATION, PROJECT_MANAGERS } from "../../data/orgChart";
import { PersonCard, TreeNode, TreeRow } from "./TreeNode";

// Ported from the original app's Org Chart tree (content.html's orgchart
// section + app.html's orgTeamNodeHtml/orgProjectNodeHtml/
// orgLeadershipNodeHtml). Layout technique is deliberately different from
// the original (see TreeNode.tsx's comment) — the DATA (who's on the
// chart, what their role is, the Asset Management branch split, the
// Site Operations/Administration matrix structure) is unchanged.
export function OrgChart() {
  return (
    <div className="org-chart">
      <TreeNode label="Leadership" defaultOpen>
        <TreeRow>
          {LEADERSHIP.levels.map((level) => (
            <TreeNode key={level.heading} label={level.heading} defaultOpen>
              <div className="person-grid">
                {level.members.map((m) => (
                  <PersonCard key={m.name} person={m} />
                ))}
              </div>
            </TreeNode>
          ))}
        </TreeRow>
      </TreeNode>

      <TreeNode label="Head Office" defaultOpen>
        <TreeRow>
          {DEPARTMENTS_ORG.map((dept) =>
            "branches" in dept ? (
              <TreeNode key={dept.id} label={dept.label}>
                <TreeRow>
                  {dept.branches.map((branch) => (
                    <TreeNode
                      key={branch.id}
                      label={
                        <>
                          {branch.label}
                          {branch.offsite && branch.location && (
                            <span className="tree-node-offsite"> ({branch.location})</span>
                          )}
                        </>
                      }
                    >
                      <div className="person-grid">
                        {branch.members.map((m) => (
                          <PersonCard key={m.name} person={m} />
                        ))}
                      </div>
                    </TreeNode>
                  ))}
                </TreeRow>
              </TreeNode>
            ) : (
              <TreeNode key={dept.id} label={dept.label}>
                <div className="person-grid">
                  {dept.members.map((m) => (
                    <PersonCard key={m.name} person={m} />
                  ))}
                </div>
              </TreeNode>
            ),
          )}
          <TreeNode label={ADMINISTRATION.label}>
            <div className="person-grid">
              {ADMINISTRATION.members.map((m) => (
                <PersonCard key={m.name} person={m} />
              ))}
            </div>
          </TreeNode>
        </TreeRow>
      </TreeNode>

      <TreeNode label="Project Sites" defaultOpen>
        <TreeRow>
          {PROJECT_MANAGERS.projects.map((project) => (
            <TreeNode
              key={project.id}
              label={project.label}
              meta={`${project.opsDepartments.length + project.adminDepartments.length} departments`}
            >
              <div className="project-lead">
                <PersonCard person={project.lead} />
                <span className="project-pm-tag">PM</span>
              </div>
              <div className="project-groups">
                <div className="project-group">
                  <div className="project-group-label">Site Operations</div>
                  {project.opsDepartments.map((d) => (
                    <div className="project-dept" key={d.label}>
                      <div className="project-dept-label">{d.label}</div>
                      <PersonCard person={d.lead} />
                      {d.staff.map((s) => (
                        <PersonCard key={s.name} person={s} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="project-matrix-divider" />
                <div className="project-group project-group-admin">
                  <div className="project-group-label">Site Administration</div>
                  {project.adminDepartments.map((d) => (
                    <div className="project-dept" key={d.label}>
                      <div className="project-dept-label">{d.label}</div>
                      <PersonCard person={d.lead} />
                      {d.staff.map((s) => (
                        <PersonCard key={s.name} person={s} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </TreeNode>
          ))}
        </TreeRow>
      </TreeNode>
    </div>
  );
}
