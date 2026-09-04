import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { getDepartmentByPhasePrefix } from '../data/allDepartments.js';
import { useProgress } from '../lib/useProgress.js';
import { useChecklistOverrides } from '../lib/useChecklistOverrides.js';
import { applyOverridesToBlock } from '../lib/applyOverrides.js';
import { useContentText } from '../lib/contentText.js';
import NameModal from '../components/NameModal.jsx';
import { CtaLink, ErrorBanner, Eyebrow, Notice, Page, PageTitle } from '../components/ui.jsx';

// Ported from the original app's phasePage() builder + checklist rendering
// (content.html/app.html) and the level-gating/phase-locking logic
// (progress.html: isItemVisible, isPhasePageUnlocked, getPrevPhaseMap).

function isItemVisible(item, level) {
  return item.level !== 'senior' || level === 'senior';
}

export default function PhasePage() {
  const { pageKey } = useParams();
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
    isTaskDone,
    toggleTask,
    identify,
    setLevel,
  } = useProgress();
  const { overrides } = useChecklistOverrides();
  const [pendingTaskId, setPendingTaskId] = useState(null);

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

  useEffect(() => {
    // Fires only on the false -> true TRANSITION, so it does not replay every
    // time a finished page is revisited. Suppressed on the last phase, where
    // finishing means the whole programme is done and the Completion page owns
    // that moment.
    if (phaseDone && !wasPhaseDone.current && !isFinalPhase) setShowPhaseComplete(true);
    wasPhaseDone.current = phaseDone;
  }, [phaseDone, isFinalPhase]);

  // Re-arm when moving between phases, so completing phase 2 still celebrates
  // after phase 1 already did.
  useEffect(() => {
    setShowPhaseComplete(false);
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
  // one unlocks — ported from getPrevPhaseMap/isPhasePageUnlocked.
  const previousPhases = effectivePhases.slice(0, phaseIndex);
  const unlocked = previousPhases.every((prevPhase) =>
    prevPhase.page.blocks
      .flatMap((b) => b.items)
      .filter((item) => isItemVisible(item, level))
      .every((item) => isTaskDone(item.id))
  );

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
    if (!name) {
      setPendingTaskId(taskId);
      return;
    }
    toggleTask(taskId);
  }

  async function handleNameSubmit(employeeName, departmentId) {
    await identify(employeeName, departmentId);
    if (pendingTaskId) {
      toggleTask(pendingTaskId);
      setPendingTaskId(null);
    }
  }

  if (!unlocked) {
    return (
      <Page>
        <PageTitle>{tc(page.title)}</PageTitle>
        <Notice>{t('checklist.locked')}</Notice>
      </Page>
    );
  }

  const allDone = page.blocks
    .flatMap((b) => b.items)
    .filter((item) => isItemVisible(item, level))
    .every((item) => isTaskDone(item.id));

  // Whole-department completion unlocks the Completion page link — ported from
  // isEmployeeOnboardingComplete. Reaching this point already implies every
  // prior phase is done (the `unlocked` check above would have returned
  // early), so this is just "is this the last phase, and is IT also done".
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
                  <li key={item.id} className="border-b border-line/60 py-2 last:border-0 dark:border-line-dark/60">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={done}
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

      {pendingTaskId && (
        <NameModal
          onSubmit={handleNameSubmit}
          onCancel={() => setPendingTaskId(null)}
          knownDepartmentId={dept.id}
        />
      )}
    </Page>
  );
}
