import { useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import { useChecklistOverrides } from '../lib/useChecklistOverrides.js';
import { useContentText } from '../lib/contentText.js';
import AdminItemRow from '../components/AdminItemRow.jsx';
import AdminCohort from '../components/AdminCohort.jsx';
import AdminSignIn from '../components/AdminSignIn.jsx';
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
// So this page asks for a real sign-in via AdminSignIn instead of a password.
// The JWT AuthProvider holds goes on every request automatically, and the API
// remains the real security boundary regardless of what this page shows — but
// the original never rendered a single field of the editor, or the roster of
// every employee's name/department/progress, before that gate passed, and
// this page should not either. AdminSignIn was built for exactly this and
// previously sat unused, so anyone signed into the portal at all — any
// employee — could open the full checklist editor and cohort roster and only
// discover the 403 after clicking Save.
// ---------------------------------------------------------------------------

const PHASES = [
  { suffix: 'day-1-30', labelKey: 'admin.phase1' },
  { suffix: 'day-31-60', labelKey: 'admin.phase2' },
  { suffix: 'day-61-90', labelKey: 'admin.phase3' },
];

export default function AdminPage() {
  const { t } = useI18n();
  const tc = useContentText();
  const { signedIn, hasRole, loading: authLoading } = useAuth();
  const loading = false;

  const [deptId, setDeptId] = useState(ALL_DEPARTMENTS[0].id);
  const [phaseSuffix, setPhaseSuffix] = useState('day-1-30');
  const [blockIndex, setBlockIndex] = useState(0);

  const { overrides, error, saveItem, deleteItem } = useChecklistOverrides();

  if (authLoading || loading) {
    return (
      <Page>
        <p className="text-ink-muted dark:text-ink-dark-muted">{t('progress.loading')}</p>
      </Page>
    );
  }

  // Gated, matching the original's password-locked renderAdminPage: nobody
  // saw a field of the editor or the employee roster before the gate passed.
  // The API still re-checks on every write — this is a courtesy against
  // showing the page at all, not a replacement for that check.
  if (!signedIn) return <AdminSignIn />;
  if (!hasRole('portal', 'admin')) return <AdminSignIn missingRole />;

  const dept = ALL_DEPARTMENTS.find((d) => d.id === deptId);
  const phase = dept.content.phases.find((p) => p.dayRange === phaseSuffix);
  // A department may not define every phase, and switching department can
  // leave blockIndex past the end of the new one's blocks.
  const block = phase?.page.blocks[blockIndex];
  const pageKey = `${dept.phasePrefix}-${phaseSuffix}`;

  // The block's items, in the order the editor actually shows and reorders
  // them: the hardcoded baseline PLUS any admin-added rows for this exact
  // page/block that carry no baseline item — addNewItem() in the original
  // created exactly that kind of row, and moveItem() reordered baseline and
  // added items together as one list. Sorted by the override's `order` when
  // set (ties broken by baseline position), matching the server's own
  // `order by page_key, sort_order nulls last, item_id`.
  const blockItems = block
    ? [
        ...block.items,
        ...Object.values(overrides).filter(
          (o) =>
            o.pageKey === pageKey &&
            o.blockIndex === blockIndex &&
            !block.items.some((it) => it.id === o.itemId) &&
            !o.deleted
        ),
      ]
        .filter((item) => !overrides[item.id ?? item.itemId]?.deleted)
        .map((item, i) => ({
          id: item.id ?? item.itemId,
          text: overrides[item.id ?? item.itemId]?.text ?? item.text ?? '',
          level: overrides[item.id ?? item.itemId]?.level ?? item.level ?? 'junior',
          order: overrides[item.id ?? item.itemId]?.order ?? i * 1000,
        }))
        .sort((a, b) => a.order - b.order)
    : [];

  async function moveItem(itemId, direction) {
    const fromIndex = blockItems.findIndex((it) => it.id === itemId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= blockItems.length) return;
    const reordered = blockItems.slice();
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Every item in the block gets a fresh order, matching moveItem()'s
    // i*1000 spacing in the original — not just the two swapped rows, since
    // ties elsewhere would otherwise leave the sort ambiguous.
    await Promise.all(
      reordered.map((item, i) =>
        saveItem(item.id, { pageKey, blockIndex, order: i * 1000 })
      )
    );
  }

  async function addNewItem() {
    const text = window.prompt(t('admin.addItemPrompt'));
    if (!text || !text.trim()) return;
    const newId = `admin-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await saveItem(newId, {
      pageKey,
      blockIndex,
      text: text.trim(),
      level: 'junior',
      order: blockItems.length * 1000,
    });
  }

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
        <>
          <ul className="flex flex-col gap-3">
            {blockItems.map((item, i) => (
              <AdminItemRow
                // The id is in the key so that switching department or phase
                // remounts each row, resetting its draft state to the new
                // item's text instead of keeping the previous one's.
                key={`${pageKey}:${item.id}`}
                itemId={item.id}
                text={item.text}
                isSenior={item.level === 'senior'}
                pageKey={pageKey}
                blockIndex={blockIndex}
                onSave={saveItem}
                onDelete={deleteItem}
                onMoveUp={() => moveItem(item.id, -1)}
                onMoveDown={() => moveItem(item.id, 1)}
                canMoveUp={i > 0}
                canMoveDown={i < blockItems.length - 1}
              />
            ))}
          </ul>

          <button
            type="button"
            onClick={addNewItem}
            className="self-start rounded-control border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent dark:border-line-dark dark:text-ink-dark-muted dark:hover:border-accent-dark dark:hover:text-accent-dark"
          >
            {t('admin.addItem')}
          </button>
        </>
      )}

      <AdminCohort />
    </Page>
  );
}
