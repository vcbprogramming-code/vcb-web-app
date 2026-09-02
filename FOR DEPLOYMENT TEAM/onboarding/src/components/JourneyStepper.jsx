import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import { useContentText } from '../lib/contentText.js';

/**
 * The sidebar journey, ported from renderSidebarProgress() in the original
 * app's progress.html.
 *
 * It replaces a flat list of page links with the seven steps the live app
 * shows, each carrying its own state:
 *
 *   1  Pre-boarding          home
 *   2  Required Documents    required-documents#required-documents
 *   3  Department Selection  required-documents#department-selection
 *   4  <Dept> Day 1-30       + Reading / Knowledge / Outputs
 *   5  <Dept> Day 31-60      + the same three
 *   6  <Dept> Day 61-90      + the same three
 *   7  Completion            completion
 *
 * WHY THE STEPS ARE NOT A CONSTANT
 *
 * Steps 4-6 do not exist until someone has picked a department: their labels
 * carry the department's short name and their sub-steps read that department's
 * checklist blocks. Before that they render as locked placeholders, which is
 * what tells a new starter that choosing a department is the thing standing
 * between them and the rest of the journey.
 *
 * WHAT "DONE" MEANS
 *
 * A phase is done when every VISIBLE item in every one of its blocks is ticked.
 * Visibility matters: senior-only items are hidden from a junior, and counting
 * them would leave a junior permanently at 90% with nothing left to click.
 * `isItemVisible` is the same predicate PhasePage uses to decide what to draw,
 * so the sidebar and the page can never disagree about what is left.
 */

const DAY_RANGES = ['day-1-30', 'day-31-60', 'day-61-90'];

// The same one-line rule PhasePage applies, deliberately duplicated rather
// than exported: a senior-only item is invisible to a junior, and if the two
// files ever disagreed the sidebar would show progress the page cannot offer.
// It is one comparison; sharing it through a module would be more machinery
// than the rule is worth.
function isItemVisible(item, level) {
  return item.level !== 'senior' || level === 'senior';
}

// PhasePage routes on a single segment - "finance-day-1-30" - and splits the
// trailing day-N-NN back off. Build the same shape here rather than inventing
// a query parameter nothing reads.
function phasePath(dept, dayRange) {
  return '/' + dept.phasePrefix + '-' + dayRange;
}

// Abbreviated in the sidebar so the column stays scannable; the page itself
// spells them out (Required Reading / Knowledge Requirements / Required
// Outputs). Matches the live app's subLabels.
const SUB_LABELS = ['stepper.reading', 'stepper.knowledge', 'stepper.outputs'];

function CheckIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LockIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Every visible item in one phase page, flattened across its three blocks. */
function phaseItems(phase, level) {
  if (!phase) return [];
  return phase.page.blocks
    .flatMap((b) => b.items)
    .filter((item) => isItemVisible(item, level));
}

/** Every visible item in ONE block of a phase — a sub-step's scope. */
function blockItems(phase, blockIndex, level) {
  const block = phase?.page?.blocks?.[blockIndex];
  if (!block) return [];
  return block.items.filter((item) => isItemVisible(item, level));
}

// An empty block counts as not done. `[].every()` is true, which would show a
// tick against a section nobody has touched.
const allDone = (items, isTaskDone) => items.length > 0 && items.every((i) => isTaskDone(i.id));

export default function JourneyStepper({
  department,
  level,
  isTaskDone,
  requiredDocsDone = false,
  onNavigate,
}) {
  const { t } = useI18n();
  const tc = useContentText();
  const { pathname, hash } = useLocation();

  const dept = department ? ALL_DEPARTMENTS.find((d) => d.id === department) : null;
  const phases = dept ? DAY_RANGES.map((r) => dept.content.phases.find((p) => p.dayRange === r)) : [null, null, null];

  const steps = [
    {
      id: 'pre-boarding',
      label: t('stepper.preBoarding'),
      to: '/',
      // Reaching the portal at all is the whole of pre-boarding in the live
      // app (hasVisitedHome). There is nothing to tick, so it is done as soon
      // as someone has told us who they are.
      done: Boolean(department) || requiredDocsDone,
      alwaysUnlocked: true,
    },
    {
      id: 'required-docs',
      label: t('stepper.requiredDocuments'),
      to: '/required-documents#required-documents',
      done: requiredDocsDone,
      alwaysUnlocked: true,
    },
    {
      id: 'dept-selection',
      label: t('stepper.departmentSelection'),
      to: '/required-documents#department-selection',
      done: Boolean(department),
      alwaysUnlocked: true,
    },
  ];

  phases.forEach((phase, i) => {
    const items = phaseItems(phase, level);
    steps.push({
      id: `phase-${i}`,
      // "Accounting Day 1-30" rather than a generic "30 Days" with the
      // department on a second line — the live app joins them at render time
      // for exactly this reason. The department name comes from its own content
      // (the same tc(dept.content.title) the flat nav used), not from an i18n
      // key nothing defines. "Team" is dropped so the row stays one line.
      label: dept
        ? `${tc(dept.content.title).replace(/\s*Team$/i, '')} ${t(`stepper.${DAY_RANGES[i]}`)}`
        : t(`stepper.${DAY_RANGES[i]}`),
      to: phase ? phasePath(dept, DAY_RANGES[i]) : null,
      done: allDone(items, isTaskDone),
      // Locked until a department exists — there is genuinely no phase page to
      // open, so a link here would lead nowhere.
      locked: !dept,
      subSteps: phase
        ? SUB_LABELS.map((label, bi) => ({
            label: t(label),
            to: `${phasePath(dept, DAY_RANGES[i])}#block-${bi}`,
            done: allDone(blockItems(phase, bi, level), isTaskDone),
          }))
        : [],
    });
  });

  const allPhasesDone = dept && phases.every((p) => allDone(phaseItems(p, level), isTaskDone));
  steps.push({
    id: 'completion',
    label: t('stepper.completion'),
    to: '/completion',
    done: Boolean(allPhasesDone),
    alwaysUnlocked: true,
  });

  // The first unfinished step is "current". Everything before it is done and
  // everything after is still ahead — one index, no per-step bookkeeping.
  const firstNotDone = steps.findIndex((s) => !s.done);
  const onCompletionPage = pathname === '/completion';

  return (
    <nav className="px-1" aria-label={t('stepper.title')}>
      {steps.map((step, i) => {
        // Completion stays "current" while you are standing on it, even once
        // it is done — otherwise finishing the journey leaves nothing marked
        // as where you are.
        const isCurrent =
          (step.id === 'completion' && onCompletionPage) || (firstNotDone !== -1 && i === firstNotDone);
        const isLast = i === steps.length - 1;
        const clickable = step.to && !step.locked;

        const dot = step.done ? (
          <CheckIcon className="h-3 w-3" />
        ) : step.locked ? (
          <LockIcon className="h-3 w-3" />
        ) : (
          String(i + 1)
        );

        const dotClass = [
          'relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
          step.done
            ? 'bg-emerald-500 text-white'
            : isCurrent
              ? 'bg-accent text-white ring-4 ring-accent/25'
              : step.locked
                ? 'bg-white/10 text-sidebar-dim'
                : 'bg-white/15 text-sidebar-text',
        ].join(' ');

        const labelClass = [
          'min-w-0 flex-1 truncate text-sm',
          step.done
            ? 'text-sidebar-text'
            : isCurrent
              ? 'font-semibold text-white'
              : step.locked
                ? 'text-sidebar-dim'
                : 'text-sidebar-text',
        ].join(' ');

        const row = (
          <>
            <span className={dotClass}>{dot}</span>
            <span className={labelClass}>{step.label}</span>
          </>
        );

        return (
          <div key={step.id} className="relative">
            {/* The connecting line runs the full height of the item, sub-steps
                included, so it reaches the next dot instead of stopping at the
                bottom of the row. */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-[23px] top-6 bottom-0 w-px ${
                  step.done ? 'bg-emerald-500/50' : 'bg-white/12'
                }`}
              />
            )}

            {clickable ? (
              <NavLink
                to={step.to}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-control px-2 py-1.5 transition-colors hover:bg-white/10"
              >
                {row}
              </NavLink>
            ) : (
              <div
                className="flex items-center gap-3 px-2 py-1.5"
                aria-disabled={step.locked ? 'true' : undefined}
                title={step.locked ? t('stepper.lockedHint') : undefined}
              >
                {row}
              </div>
            )}

            {/* Sub-steps deep-link into one checklist block, so "Reading" opens
                Required Reading rather than the top of the phase page. */}
            {step.subSteps?.length ? (
              <div className="ml-[34px] flex flex-col gap-0.5 pb-1">
                {step.subSteps.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2 rounded-control px-2 py-1 text-xs transition-colors hover:bg-white/10',
                        isActive && hash === new URL(sub.to, 'http://x').hash
                          ? 'text-white'
                          : sub.done
                            ? 'text-sidebar-text'
                            : 'text-sidebar-dim',
                      ].join(' ')
                    }
                  >
                    <span
                      className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${
                        sub.done ? 'bg-emerald-500 text-white' : 'border border-white/25'
                      }`}
                    >
                      {sub.done ? <CheckIcon className="h-2 w-2" /> : null}
                    </span>
                    <span className="truncate">{sub.label}</span>
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
