import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { getDepartmentByPhasePrefix } from '../data/allDepartments.js';
import { useProgress } from '../lib/useProgress.js';
import { useChecklistOverrides } from '../lib/useChecklistOverrides.js';
import { applyOverridesToBlock } from '../lib/applyOverrides.js';
import { areRequiredDocsComplete } from '../lib/requiredDocsGate.js';
import { useContentText } from '../lib/contentText.js';
import NameModal from '../components/NameModal.jsx';
import DepartmentSwitchModal from '../components/DepartmentSwitchModal.jsx';
import { useRewardToast } from '../components/RewardToast.jsx';
import { CtaLink, ErrorBanner, Eyebrow, Notice, Page, PageTitle } from '../components/ui.jsx';

// Ported from the original app's phasePage() builder + checklist rendering
// (content.html/app.html) and the level-gating/phase-locking logic
// (progress.html: isItemVisible, isPhasePageUnlocked, getPrevPhaseMap).

function isItemVisible(item, level) {
  return item.level !== 'senior' || level === 'senior';
}

export default function PhasePage() {
  const { pageKey } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const tc = useContentText();

  // pageKey looks like "finance-day-1-30" — split off "day-N-NN" (the
  // original app's own <prefix>day-1-30 convention) as dayRange, everything
  // before it as the department's phase prefix.
  const dayRangeMatch = pageKey?.match(/day-\d+-\d+$/);
  const dayRange = dayRangeMatch?.[0];
  const phasePrefix = dayRange ? pageKey.slice(0, -(dayRange.length + 1)) : undefined;

  const {
    name,
    level,
    loaded,
    loadError,
    saveError,
    dismissSaveError,
    department,
    isTaskDone,
    toggleTask,
    identify,
    setLevel,
    switchDepartment,
  } = useProgress();
  const { overrides } = useChecklistOverrides();
  const [pendingTaskId, setPendingTaskId] = useState(null);
  // Set when identify() reports the employee already has progress in a
  // DIFFERENT department than this phase page's own — mirrors
  // promptDepartmentSwitchConfirm in the original, asked before anything is
  // discarded rather than switching silently.
  const [pendingSwitch, setPendingSwitch] = useState(null);

  /* Phase-completion celebration, ported from the original app's
     celebratePhaseComplete (progress.html). Finishing a 30-day phase is the
     moment an employee actually becomes able to move on, and nothing marked
     it — the Next Phase link simply stopped being disabled, which is easy to
     miss.

     These hooks MUST sit above this component's early returns (phase-not-found
     and phase-locked): hooks have to run in the same order on every render, so
     calling them after a conditional return crashes React. They therefore take
     their inputs via setPhaseDone below rather than reading the allDone
     computed further down. */
  const [phaseDone, setPhaseDone] = useState(false);
  const [isFinalPhase, setIsFinalPhase] = useState(false);
  const wasPhaseDone = useRef(false);
  const [showPhaseComplete, setShowPhaseComplete] = useState(false);
  // The bigger, one-time celebration for finishing the whole 90-day
  // programme — ported from celebrateOnboardingComplete. Takes over the
  // false -> true transition INSTEAD of the phase-complete popup precisely
  // when the phase that just finished is also the final one.
  const [showOnboardingComplete, setShowOnboardingComplete] = useState(false);
  const { showReward, node: rewardToastNode } = useRewardToast();

  useEffect(() => {
    // Fires only on the false -> true TRANSITION, so it does not replay every
    // time a finished page is revisited.
    if (phaseDone && !wasPhaseDone.current) {
      if (isFinalPhase) setShowOnboardingComplete(true);
      else setShowPhaseComplete(true);
    }
    wasPhaseDone.current = phaseDone;
  }, [phaseDone, isFinalPhase]);

  // Re-arm when moving between phases, so completing phase 2 still celebrates
  // after phase 1 already did.
  useEffect(() => {
    setShowPhaseComplete(false);
    setShowOnboardingComplete(false);
    wasPhaseDone.current = false;
  }, [pageKey]);

  const dept = phasePrefix ? getDepartmentByPhasePrefix(phasePrefix) : undefined;
  const phase = dept?.content.phases.find((p) => p.dayRange === dayRange);

  if (!dept || !phase) {
    return (
      <Page>
        <PageTitle>{t('checklist.phaseNotFound')}</PageTitle>
      </Page>
    );
  }

  const { content } = dept;
  const phaseIndex = content.phases.findIndex((p) => p.dayRange === dayRange);

  // Admin-editor overrides are applied to every phase's blocks up front, so
  // phase-locking, "allDone" and rendering all agree on the same effective
  // item set — ported from applyChecklistOverrides being applied once to the
  // whole PAGES object rather than per-render.
  const effectivePhases = content.phases.map((p) => ({
    ...p,
    page: {
      ...p.page,
      blocks: p.page.blocks.map((block, blockIdx) =>
        applyOverridesToBlock(block, overrides, `${dept.phasePrefix}-${p.dayRange}`, blockIdx)
      ),
    },
  }));
  const page = effectivePhases[phaseIndex].page;

  // Every prior phase in this department must be fully complete before this
  // one unlocks — ported from getPrevPhaseMap/isPhasePageUnlocked. The first
  // phase (phaseIndex === 0) additionally requires Required Documents —
  // isPhasePageUnlocked's own first check — so a typed-URL visit here can't
  // bypass the same gate the Department Selection click already enforces.
  //
  // Unlike an earlier version of this port, `unlocked` does NOT gate the
  // whole page: the original's isPhasePageUnlocked only gates checkbox
  // *toggling* (see performToggle in progress.html) — every phase page is
  // freely viewable/readable once Required Documents is done, even ahead of
  // where the employee has actually reached. Locked checkboxes render
  // disabled in place, with a single banner above the checklist explaining
  // why (renderPhaseLockNotice), not a page that replaces all its content.
  const docsComplete = areRequiredDocsComplete(isTaskDone);
  const previousPhases = effectivePhases.slice(0, phaseIndex);
  const previousPhasesComplete = previousPhases.every((prevPhase) =>
    prevPhase.page.blocks
      .flatMap((b) => b.items)
      .filter((item) => isItemVisible(item, level))
      .every((item) => isTaskDone(item.id))
  );
  const unlocked = docsComplete && previousPhasesComplete;
  const lockReason = !docsComplete ? 'checklist.lockedDocs' : 'checklist.lockedPhase';

  if (!loaded) {
    // A failed load deliberately leaves `loaded` false (see useProgress) so it
    // retries on the next mount — but it must SAY so rather than looking like
    // an endless spinner or, worse, an empty checklist.
    return (
      <Page>
        {loadError ? (
          <ErrorBanner>{t(loadError)}</ErrorBanner>
        ) : (
          <p className="text-ink-muted dark:text-ink-dark-muted">{t('progress.loading')}</p>
        )}
      </Page>
    );
  }

  function handleToggle(taskId) {
    // Mirrors performToggle's own guard: a locked checkbox that somehow still
    // received a click (already `disabled`, but belt-and-suspenders) is a
    // silent no-op, not an error — the click never happened as far as saved
    // state is concerned.
    if (!unlocked) return;
    if (!name) {
      setPendingTaskId(taskId);
      return;
    }
    // Read before toggling: the reward toast fires only on the off -> on
    // transition, matching the original's `if (newState) showRewardToast()`
    // — unchecking a mistaken tick shouldn't celebrate.
    if (!isTaskDone(taskId)) showReward();
    toggleTask(taskId);
  }

  async function handleNameSubmit(employeeName, departmentId) {
    const result = await identify(employeeName, departmentId);
    if (result === 'confirm-switch') {
      // identify() deliberately left the department unchanged — the pending
      // task stays pending until the switch is confirmed or cancelled below.
      setPendingSwitch({ from: department, to: departmentId });
      return;
    }
    if (pendingTaskId) {
      toggleTask(pendingTaskId);
      setPendingTaskId(null);
    }
  }

  async function confirmSwitch() {
    const { from, to } = pendingSwitch;
    setPendingSwitch(null);
    await switchDepartment(from, to);
    if (pendingTaskId) {
      toggleTask(pendingTaskId);
      setPendingTaskId(null);
    }
  }

  const allDone = page.blocks
    .flatMap((b) => b.items)
    .filter((item) => isItemVisible(item, level))
    .every((item) => isTaskDone(item.id));

  // Whole-department completion unlocks the Completion page link — ported
  // from isEmployeeOnboardingComplete: just "is this the last phase, and is
  // IT also done" (allDone already only reflects this phase's own items;
  // reaching a done last phase implies every prior one was completed too,
  // since finishing a phase is what unlocks the next).
  const isLastPhase = phaseIndex === content.phases.length - 1;
  const departmentComplete = isLastPhase && allDone;

  // Publish this render's completion state to the celebration hooks above —
  // they cannot compute it themselves, because they run before page and level
  // are resolved. Guarded so it only sets state when the value actually
  // changes, which is what stops it looping.
  if (phaseDone !== allDone) setPhaseDone(allDone);
  if (isFinalPhase !== isLastPhase) setIsFinalPhase(isLastPhase);

  const nextPhaseTitle = page.nextPhasePage
    ? content.phases.find((p) => `${dept.phasePrefix}-${p.dayRange}` === page.nextPhasePage)?.page
        .title ?? ''
    : '';

  return (
    <Page>
      <div>
        <Eyebrow>{tc(page.eyebrow)}</Eyebrow>
        <PageTitle>{tc(page.title)}</PageTitle>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink-muted dark:text-ink-dark-muted">
          {t('checklist.track')}:
        </span>
        <div className="flex gap-1 rounded-pill bg-surface-sunken p-1 dark:bg-surface-dark-sunken">
          {['junior', 'senior'].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              aria-pressed={level === lv}
              className={[
                'rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors',
                level === lv
                  ? 'bg-accent text-white dark:bg-accent-dark dark:text-surface-dark'
                  : 'text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark',
              ].join(' ')}
            >
              {t(lv === 'junior' ? 'checklist.junior' : 'checklist.senior')}
            </button>
          ))}
        </div>
      </div>

      {/* renderPhaseLockNotice, ported: one banner above the checklist
          explaining why locked items are disabled — not repeated per block,
          and never a substitute for showing the checklist itself. */}
      {!unlocked && (
        <Notice>
          <span aria-hidden="true">🔒</span> {t(lockReason)}
        </Notice>
      )}

      {page.blocks.map((block) => (
        <section
          key={block.heading}
          className="rounded-card border border-line bg-surface-card p-5 shadow-card dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
        >
          <h2 className="mb-3 text-xl font-bold">{tc(block.heading)}</h2>
          <ul className="flex flex-col">
            {block.items
              .filter((item) => isItemVisible(item, level))
              .map((item) => {
                const done = isTaskDone(item.id);
                return (
                  <li
                    key={item.id}
                    className={[
                      'border-b border-line/60 py-2 last:border-0 dark:border-line-dark/60',
                      !unlocked ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <label
                      className={['flex items-start gap-3', !unlocked ? 'cursor-not-allowed' : 'cursor-pointer'].join(
                        ' '
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={!unlocked}
                        onChange={() => handleToggle(item.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-accent dark:accent-accent-dark"
                      />
                      <span
                        className={
                          done
                            ? 'text-ink-muted line-through dark:text-ink-dark-muted'
                            : undefined
                        }
                      >
                        {tc(item.text)}
                      </span>
                    </label>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {/* A save that failed after its retry reverted the checkbox — say so,
          otherwise the tick silently un-ticks itself. Equivalent to the
          original app's showSaveFailedToast(). */}
      {saveError && (
        <ErrorBanner onDismiss={dismissSaveError} dismissLabel={t('progress.dismiss')}>
          {t(saveError)}
        </ErrorBanner>
      )}

      {page.closing && (
        <p className="text-lg font-semibold italic text-ink-subtle dark:text-ink-dark-muted">
          {tc(page.closing)}
        </p>
      )}

      {page.nextPhasePage && (
        <div>
          <CtaLink to={`/${page.nextPhasePage}`} disabled={!allDone}>
            {t('checklist.nextPhase')}
            {/* A text badge, not just colour — a colour cue alone conveys
                nothing to a screen reader. */}
            {allDone && (
              <span className="ml-2 rounded-pill bg-white/25 px-2 py-0.5 text-xs">
                {t('checklist.nextUp')}
              </span>
            )}
          </CtaLink>
        </div>
      )}

      {!page.nextPhasePage && (
        <div>
          <CtaLink to="/completion" disabled={!departmentComplete}>
            {t('checklist.continueToCompletion')}
          </CtaLink>
        </div>
      )}

      {showPhaseComplete && page.nextPhasePage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhaseComplete(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-card border border-line bg-surface-card p-6 text-center shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="phase-complete-title"
          >
            <Eyebrow>{t('checklist.phaseComplete')}</Eyebrow>
            <h3 id="phase-complete-title" className="mb-2 mt-1 text-2xl font-bold">
              {tc(page.title)}
            </h3>
            <p className="mb-5 text-sm text-ink-muted dark:text-ink-dark-muted">
              {t('checklist.phaseCompleteSub')}
            </p>
            {/* No auto-dismiss timer: this card asks the employee to make a
                choice, so it waits rather than vanishing mid-decision. */}
            <div className="flex flex-col gap-2">
              <CtaLink
                to={`/${page.nextPhasePage}`}
                onClick={() => setShowPhaseComplete(false)}
              >
                {nextPhaseTitle
                  ? `${t('checklist.start')} ${tc(nextPhaseTitle)}`
                  : t('checklist.goToNextPhase')}
              </CtaLink>
              <button
                type="button"
                onClick={() => setShowPhaseComplete(false)}
                className="rounded-pill px-6 py-2 text-sm font-semibold text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
              >
                {t('checklist.stayOnPage')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-time celebration for finishing the entire 90-day programme —
          ported from celebrateOnboardingComplete. Bigger and more final than
          the per-phase popup above: no "next phase" choice, just Print or
          Continue, and Continue lands on the dedicated Completion page
          rather than reopening in place. */}
      {showOnboardingComplete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowOnboardingComplete(false);
              navigate('/completion');
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-card border border-line bg-surface-card p-6 text-center shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-complete-title"
          >
            <div className="mx-auto mb-1 text-4xl" aria-hidden="true">
              🎉
            </div>
            <Eyebrow>{t('completion.eyebrow')}</Eyebrow>
            <h3 id="onboarding-complete-title" className="mb-2 mt-1 text-2xl font-bold">
              {t('completion.welcome')}
            </h3>
            <p className="mb-5 text-sm text-ink-muted dark:text-ink-dark-muted">
              {t('content.youVeCompletedTheFull90Day')}
              {dept ? ` — ${tc(dept.content.title)}` : ''}. {t('content.everyChecklistEveryDocumentEveryPhaseThat')}
            </p>
            {/* No auto-dismiss timer — this moment waits for the employee to
                close it themselves rather than being rushed. */}
            <div className="flex flex-col gap-2">
              <CtaLink to="/completion?print=1" onClick={() => setShowOnboardingComplete(false)}>
                {t('completion.print')}
              </CtaLink>
              <button
                type="button"
                onClick={() => {
                  setShowOnboardingComplete(false);
                  navigate('/completion');
                }}
                className="rounded-pill px-6 py-2 text-sm font-semibold text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
              >
                {t('name.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {rewardToastNode}

      {pendingTaskId && !pendingSwitch && (
        <NameModal
          onSubmit={handleNameSubmit}
          onCancel={() => setPendingTaskId(null)}
          knownDepartmentId={dept.id}
        />
      )}

      {pendingSwitch && (
        <DepartmentSwitchModal
          fromDeptId={pendingSwitch.from}
          toDeptId={pendingSwitch.to}
          onConfirm={confirmSwitch}
          onCancel={() => {
            setPendingSwitch(null);
            setPendingTaskId(null);
          }}
        />
      )}
    </Page>
  );
}
