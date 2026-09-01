import { useI18n } from '@vcb/shared';
import { GROUP_STRUCTURE } from '../../data/orgChart.js';
import { useContentText } from '../../lib/contentText.js';

// Vichitbhan's position within the wider Vichitbhan Group: who owns it
// (Chavananand Family), sibling family-owned companies (VPO, Chavananand
// Holding — NOT part of VCB's own corporate structure, so shown distinctly),
// and what VCB itself owns or co-owns.
//
// Ported from the original app's renderGroupStructureHtml (app.html).
// Connector lines are plain borders rather than measured DOM positions, for
// the reason given in TreeNode.jsx.

function FamilyCompanyCard({ entity }) {
  const tc = useContentText();
  return (
    // The tooltip is a CSS hover/focus reveal rather than React state: it is
    // pure presentation, and group-hover/group-focus-within keeps it keyboard
    // reachable without a state update per pointer move.
    <div className="group relative">
      <div
        tabIndex={0}
        className="cursor-help rounded-card border border-dashed border-line bg-surface-sunken px-3 py-2 text-center text-xs font-semibold dark:border-line-dark dark:bg-surface-dark-sunken"
      >
        {tc(entity.label)}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-card border border-line bg-surface-card p-2 text-xs opacity-0 shadow-card-hover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-line-dark dark:bg-surface-dark-card">
        {tc(entity.sub)}
      </div>
    </div>
  );
}

function JvCard({ jv }) {
  const tc = useContentText();
  return (
    <div className="rounded-card border border-line bg-surface-card px-3 py-2 text-center dark:border-line-dark dark:bg-surface-dark-card">
      <div className="text-sm font-bold text-accent dark:text-accent-dark">{tc(jv.label)}</div>
      <div className="text-[0.7rem] text-ink-muted dark:text-ink-dark-muted">
        {jv.parents.map((p) => tc(p)).join(' & ')}
      </div>
    </div>
  );
}

export default function GroupStructure() {
  const { t } = useI18n();
  const tc = useContentText();
  const { groupName, shareholders, parent, familyCompanies, subsidiaries, jvs } = GROUP_STRUCTURE;

  const half = Math.ceil(familyCompanies.length / 2);

  return (
    <div className="relative flex flex-col items-center gap-6 rounded-card border-2 border-dashed border-line p-6 dark:border-line-dark">
      <div className="absolute -top-3 left-6 bg-surface-alt px-2 text-xs font-bold uppercase tracking-wide text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
        {tc(groupName)}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {shareholders.map((s) => (
          <div
            key={s.id}
            className="rounded-card border border-line bg-surface-card px-4 py-2 text-sm font-semibold dark:border-line-dark dark:bg-surface-dark-card"
          >
            {tc(s.label)}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {familyCompanies.slice(0, half).map((c) => (
          <FamilyCompanyCard key={c.id} entity={c} />
        ))}

        <div className="rounded-card border-2 border-accent bg-surface-card px-5 py-3 text-center shadow-card dark:border-accent-dark dark:bg-surface-dark-card">
          <h3 className="text-base font-extrabold">{tc(parent.label)}</h3>
          <p className="max-w-xs text-xs text-ink-muted dark:text-ink-dark-muted">
            {tc(parent.sub)}
          </p>
        </div>

        {familyCompanies.slice(half).map((c) => (
          <FamilyCompanyCard key={c.id} entity={c} />
        ))}
      </div>

      <div className="flex w-full flex-col gap-5 border-t border-line pt-5 dark:border-line-dark">
        <div className="flex flex-col gap-2">
          <div className="text-center text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
            {t('org.subsidiaries')}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {subsidiaries.map((s) => (
              <div
                key={s.id}
                className="max-w-xs rounded-card border border-line bg-surface-card px-3 py-2 text-center dark:border-line-dark dark:bg-surface-dark-card"
              >
                <h4 className="text-sm font-bold">{tc(s.label)}</h4>
                <p className="text-[0.7rem] text-ink-muted dark:text-ink-dark-muted">
                  {tc(s.sub)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-center text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
            {t('org.jointVentures')}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {jvs.map((jv) => (
              <JvCard key={jv.id} jv={jv} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
