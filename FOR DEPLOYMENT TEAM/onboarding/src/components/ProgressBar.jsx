import { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { DEPARTMENTS } from '../data/departments.js';
import { getDepartmentTaskIds } from '../lib/departmentTasks.js';
import { useContentText } from '../lib/contentText.js';

// Ported from renderOverallProgress() in the original app's progress.html —
// the persistent "Your Onboarding Progress — <name> (<department>) NN%" bar
// shown above the fold on every page once an employee has a name AND a
// department (pre-boarding has no department context yet, so it renders
// nothing rather than a 0% bar with nowhere to point).
//
// The fill width transitions on mount/percentage change (see the width
// delay below) rather than snapping straight to its value — the "the
// progress bar has to slowly fill" behaviour the CSS transition on
// .progress-bar-fill gives the original for free.
export default function ProgressBar({ name, department, level, isTaskDone }) {
  const { t } = useI18n();
  const tc = useContentText();
  const [displayPct, setDisplayPct] = useState(0);

  const dept = department ? DEPARTMENTS.find((d) => d.id === department) : null;
  const allIds = dept ? getDepartmentTaskIds(dept.id, level) : [];
  const done = allIds.filter((id) => isTaskDone(id)).length;
  const pct = allIds.length ? Math.round((done / allIds.length) * 100) : 0;

  // One tick after the target changes, so the browser has already painted
  // the previous width and the transition has something to animate FROM —
  // setting it in the same render as a fresh 0% (page just mounted) would
  // otherwise jump straight to the new value with nothing to see.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDisplayPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  if (!name || !dept) return null;

  return (
    <div className="rounded-control bg-white/5 px-3.5 py-3 text-white">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="min-w-0 truncate">
          {t('content.yourOnboardingProgress')} — {name} ({tc(dept.label)})
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
          style={{ width: `${displayPct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-sidebar-dim">
        {done} / {allIds.length} {t('content.tasksCompleteInYourDepartment')}
      </div>
    </div>
  );
}
