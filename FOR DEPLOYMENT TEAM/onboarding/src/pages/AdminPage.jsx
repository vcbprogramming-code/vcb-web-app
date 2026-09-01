import { useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import { useChecklistOverrides } from '../lib/useChecklistOverrides.js';
import { useContentText } from '../lib/contentText.js';
import AdminSignIn from '../components/AdminSignIn.jsx';
import AdminItemRow from '../components/AdminItemRow.jsx';
import AdminCohort from '../components/AdminCohort.jsx';
import { ErrorBanner, Page, PageTitle } from '../components/ui.jsx';

// The checklist editor, ported from the original app's admin.html.
//
// ---------------------------------------------------------------------------
// THE SHARED ADMIN PASSWORD IS GONE — this is the change that matters here.
// ---------------------------------------------------------------------------
// The original gate was a password box checked by check_admin_password(), a
// security-definer function granted to `anon`. 007_onboarding.sql DROPS that
// function and its two write helpers; the API now gates PUT/DELETE
// /api/onboarding/checklist on requireAuth + requireRole('portal','admin').
//
// So this page asks for a real sign-in, and the password is not threaded down
// to each row any more — there is no password. The JWT AuthProvider holds goes
// on every request automatically, and the API is the gate. Hiding the editor
// from someone without the role, below, is only a courtesy so they do not fill
// in a form that would 403; it is not the security boundary. See the header of
// shared/src/auth.jsx.
// ---------------------------------------------------------------------------

const PHASES = [
  { suffix: 'day-1-30', labelKey: 'admin.phase1' },
  { suffix: 'day-31-60', labelKey: 'admin.phase2' },
  { suffix: 'day-61-90', labelKey: 'admin.phase3' },
];

export default function AdminPage() {
  const { t } = useI18n();
  const tc = useContentText();
  const { signedIn, hasRole, loading } = useAuth();

  const [deptId, setDeptId] = useState(ALL_DEPARTMENTS[0].id);
  const [phaseSuffix, setPhaseSuffix] = useState('day-1-30');
  const [blockIndex, setBlockIndex] = useState(0);

  const { overrides, error, saveItem, deleteItem } = useChecklistOverrides();

  if (loading) {
    return (
      <Page>
        <p className="text-ink-muted dark:text-ink-dark-muted">{t('progress.loading')}</p>
      </Page>
    );
  }

  // Not signed in, or signed in without the role: show the sign-in panel
  // rather than an editor whose every save would be refused.
  if (!signedIn) return <AdminSignIn />;
  if (!hasRole('portal', 'admin')) return <AdminSignIn missingRole />;

  const dept = ALL_DEPARTMENTS.find((d) => d.id === deptId);
  const phase = dept.content.phases.find((p) => p.dayRange === phaseSuffix);
  // A department may not define every phase, and switching department can
  // leave blockIndex past the end of the new one's blocks.
  const block = phase?.page.blocks[blockIndex];
  const pageKey = `${dept.phasePrefix}-${phaseSuffix}`;

  const tabClass = (active) =>
    [
      'rounded-control px-3 py-1.5 text-sm font-semibold transition-colors',
      active
        ? 'bg-accent text-white dark:bg-accent-dark dark:text-surface-dark'
        : 'bg-surface-sunken text-ink-muted hover:text-ink dark:bg-surface-dark-sunken dark:text-ink-dark-muted dark:hover:text-ink-dark',
    ].join(' ');

  return (
    <Page>
      <PageTitle>{t('admin.editorTitle')}</PageTitle>

      {error && <ErrorBanner>{t(error)}</ErrorBanner>}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {ALL_DEPARTMENTS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={tabClass(d.id === deptId)}
              onClick={() => {
                setDeptId(d.id);
                setBlockIndex(0);
              }}
            >
              {tc(d.content.title)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <button
              key={p.suffix}
              type="button"
              className={tabClass(p.suffix === phaseSuffix)}
              onClick={() => {
                setPhaseSuffix(p.suffix);
                setBlockIndex(0);
              }}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {phase?.page.blocks.map((b, i) => (
            <button
              key={b.heading}
              type="button"
              className={tabClass(i === blockIndex)}
              onClick={() => setBlockIndex(i)}
            >
              {tc(b.heading)}
            </button>
          ))}
        </div>
      </div>

      {block && (
        <ul className="flex flex-col gap-3">
          {block.items
            .filter((item) => !overrides[item.id]?.deleted)
            .map((item) => {
              const override = overrides[item.id];
              return (
                <AdminItemRow
                  // The id is in the key so that switching department or phase
                  // remounts each row, resetting its draft state to the new
                  // item's text instead of keeping the previous one's.
                  key={`${pageKey}:${item.id}`}
                  itemId={item.id}
                  text={override?.text ?? item.text}
                  isSenior={(override?.level ?? item.level) === 'senior'}
                  pageKey={pageKey}
                  blockIndex={blockIndex}
                  onSave={saveItem}
                  onDelete={deleteItem}
                />
              );
            })}
        </ul>
      )}

      <AdminCohort />
    </Page>
  );
}
