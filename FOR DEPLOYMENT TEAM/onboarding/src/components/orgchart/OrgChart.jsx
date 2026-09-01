import { useI18n } from '@vcb/shared';
import {
  LEADERSHIP,
  DEPARTMENTS_ORG,
  ADMINISTRATION,
  PROJECT_MANAGERS,
} from '../../data/orgChart.js';
import { PersonCard, PersonGrid, TreeNode, TreeRow } from './TreeNode.jsx';
import { useContentText } from '../../lib/contentText.js';

// The org tree, ported from the original app's content.html orgchart section.
// The DATA — who is on the chart, their role, the Asset Management branch
// split, the Site Operations / Site Administration matrix — is unchanged; only
// the layout technique differs (see TreeNode.jsx).

export default function OrgChart() {
  const { t } = useI18n();
  const tc = useContentText();

  return (
    <div className="flex flex-col items-center gap-8 overflow-x-auto py-4">
      <TreeNode label={t('org.leadership')} defaultOpen>
        <TreeRow>
          {LEADERSHIP.levels.map((level) => (
            <TreeNode key={level.heading} label={tc(level.heading)} defaultOpen>
              <PersonGrid>
                {level.members.map((m) => (
                  <PersonCard key={m.name} person={m} />
                ))}
              </PersonGrid>
            </TreeNode>
          ))}
        </TreeRow>
      </TreeNode>

      <TreeNode label={t('org.headOffice')} defaultOpen>
        <TreeRow>
          {DEPARTMENTS_ORG.map((dept) =>
            'branches' in dept ? (
              <TreeNode key={dept.id} label={tc(dept.label)}>
                <TreeRow>
                  {dept.branches.map((branch) => (
                    <TreeNode
                      key={branch.id}
                      label={
                        <>
                          {tc(branch.label)}
                          {branch.offsite && branch.location && (
                            <span className="font-medium text-ink-muted dark:text-ink-dark-muted">
                              {' '}
                              ({tc(branch.location)})
                            </span>
                          )}
                        </>
                      }
                    >
                      <PersonGrid>
                        {branch.members.map((m) => (
                          <PersonCard key={m.name} person={m} />
                        ))}
                      </PersonGrid>
                    </TreeNode>
                  ))}
                </TreeRow>
              </TreeNode>
            ) : (
              <TreeNode key={dept.id} label={tc(dept.label)}>
                <PersonGrid>
                  {dept.members.map((m) => (
                    <PersonCard key={m.name} person={m} />
                  ))}
                </PersonGrid>
              </TreeNode>
            )
          )}
          <TreeNode label={tc(ADMINISTRATION.label)}>
            <PersonGrid>
              {ADMINISTRATION.members.map((m) => (
                <PersonCard key={m.name} person={m} />
              ))}
            </PersonGrid>
          </TreeNode>
        </TreeRow>
      </TreeNode>

      <TreeNode label={t('org.projectSites')} defaultOpen>
        <TreeRow>
          {PROJECT_MANAGERS.projects.map((project) => (
            <TreeNode
              key={project.id}
              label={tc(project.label)}
              meta={`${project.opsDepartments.length + project.adminDepartments.length} ${t('org.departments')}`}
            >
              <div className="mt-2 flex flex-col items-center gap-1">
                <PersonCard person={project.lead} />
                <span className="rounded-pill bg-accent px-2 py-0.5 text-[0.6rem] font-bold text-white dark:bg-accent-dark dark:text-surface-dark">
                  PM
                </span>
              </div>

              {/* The ops/admin matrix. Side by side on desktop, stacked on
                  narrow screens where the divider is meaningless. */}
              <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start">
                <div className="flex flex-col gap-2">
                  <div className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                    {t('org.siteOperations')}
                  </div>
                  {project.opsDepartments.map((d) => (
                    <div key={d.label} className="flex flex-col gap-1">
                      <div className="text-xs font-semibold">{tc(d.label)}</div>
                      <PersonCard person={d.lead} />
                      {d.staff.map((s) => (
                        <PersonCard key={s.name} person={s} />
                      ))}
                    </div>
                  ))}
                </div>

                <div className="hidden w-px self-stretch bg-line dark:bg-line-dark md:block" />

                <div className="flex flex-col gap-2">
                  <div className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                    {t('org.siteAdministration')}
                  </div>
                  {project.adminDepartments.map((d) => (
                    <div key={d.label} className="flex flex-col gap-1">
                      <div className="text-xs font-semibold">{tc(d.label)}</div>
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
