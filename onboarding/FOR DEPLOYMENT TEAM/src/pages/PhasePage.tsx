import { Link, useParams } from "react-router-dom";
import { getDepartmentByPhasePrefix } from "../data/allDepartments";
import type { ChecklistItem } from "../data/types";
import { useProgress } from "../lib/useProgress";
import { NameModal } from "../components/NameModal";
import { useT } from "../lib/LangContext";
import { useChecklistOverrides } from "../lib/useChecklistOverrides";
import { applyOverridesToBlock } from "../lib/applyOverrides";
import { useEffect, useRef, useState } from "react";

// Ported from the original app's phasePage() builder + checklist rendering
// (content.html/app.html) and the level-gating/phase-locking logic
// (progress.html: isItemVisible, isPhasePageUnlocked, getPrevPhaseMap).

function isItemVisible(item: ChecklistItem, level: "junior" | "senior") {
  return item.level !== "senior" || level === "senior";
}

export function PhasePage() {
  const { pageKey } = useParams<{ pageKey: string }>();
  // pageKey looks like "finance-day-1-30" — split off "day-N-NN" (matching
  // the original app's own <prefix>day-1-30 page-key convention, see
  // getDepartmentPhaseChain in the original progress.html) as dayRange,
  // everything before it as the department's phase prefix.
  const dayRangeMatch = pageKey?.match(/day-\d+-\d+$/);
  const dayRange = dayRangeMatch?.[0];
  const phasePrefix = dayRange ? pageKey!.slice(0, -(dayRange.length + 1)) : undefined;
  const { name, level, loaded, loadError, saveError, dismissSaveError, isTaskDone, toggleTask, identify, setLevel } =
    useProgress();
  const { overrides } = useChecklistOverrides();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const { t } = useT();

  /* Phase-completion celebration, ported from the original app's
     celebratePhaseComplete (progress.html). Finishing a 30-day phase is the
     moment an employee actually becomes able to move on, and nothing marked
     it — the Next Phase link simply stopped being disabled, which is easy
     to miss.

     These hooks MUST sit above this component's early returns (phase-not-
     found and phase-locked): hooks have to run in the same order on every
     render, so calling them after a conditional return crashes React. They
     therefore take their inputs via setPhaseDone below rather than reading
     the allDone computed further down. */
  const [phaseDone, setPhaseDone] = useState(false);
  const [isFinalPhase, setIsFinalPhase] = useState(false);
  const wasPhaseDone = useRef(false);
  const [showPhaseComplete, setShowPhaseComplete] = useState(false);
  useEffect(() => {
    // Fires only on the false -> true TRANSITION, so it does not replay
    // every time a finished page is revisited or re-rendered. Suppressed on
    // the last phase, where finishing means the whole program is done and
    // the Completion page owns that moment.
    if (phaseDone && !wasPhaseDone.current && !isFinalPhase) setShowPhaseComplete(true);
    wasPhaseDone.current = phaseDone;
  }, [phaseDone, isFinalPhase]);
  // Re-arm when moving between phases, so completing phase 2 still
  // celebrates after phase 1 already did.
  useEffect(() => {
    setShowPhaseComplete(false);
    wasPhaseDone.current = false;
  }, [pageKey]);

  const dept = phasePrefix ? getDepartmentByPhasePrefix(phasePrefix) : undefined;
  const phase = dept?.content.phases.find((p) => p.dayRange === dayRange);

  if (!dept || !phase) {
    return (
      <div className="page">
        <h1>Phase not found</h1>
      </div>
    );
  }

  const { content } = dept;
  const phaseIndex = content.phases.findIndex((p) => p.dayRange === dayRange);

  // Admin-editor overrides (see useChecklistOverrides/applyOverridesToBlock)
  // are applied to every phase's blocks up front, so phase-locking,
  // "allDone", and rendering all agree on the same effective item set —
  // ported from applyChecklistOverrides being applied once to the whole
  // PAGES object in the original app, rather than per-render here.
  const effectivePhases = content.phases.map((p, i) => ({
    ...p,
    page: {
      ...p.page,
      blocks: p.page.blocks.map((block, blockIdx) =>
        applyOverridesToBlock(block, overrides, `${dept.phasePrefix}-${p.dayRange}`, blockIdx),
      ),
    },
    _index: i,
  }));
  const page = effectivePhases[phaseIndex].page;

  // Every prior phase in this department must be fully complete before
  // this one unlocks — ported from getPrevPhaseMap/isPhasePageUnlocked.
  const previousPhases = effectivePhases.slice(0, phaseIndex);
  const unlocked = previousPhases.every((prevPhase) =>
    prevPhase.page.blocks
      .flatMap((b) => b.items)
      .filter((item) => isItemVisible(item, level))
      .every((item) => isTaskDone(item.id)),
  );

  if (!loaded) {
    // A failed load deliberately leaves "loaded" false (see useProgress) so it
    // retries on the next mount — but it must SAY so rather than looking
    // like an endless spinner or, worse, an empty checklist.
    return (
      <div className="page">
        {loadError ? <p className="form-error" role="alert">{t(loadError)}</p> : <p>Loading…</p>}
      </div>
    );
  }

  function handleToggle(taskId: string) {
    if (!name) {
      setPendingTaskId(taskId);
      return;
    }
    toggleTask(taskId);
  }

  async function handleNameSubmit(employeeName: string, departmentId: string) {
    await identify(employeeName, departmentId);
    if (pendingTaskId) {
      toggleTask(pendingTaskId);
      setPendingTaskId(null);
    }
  }

  if (!unlocked) {
    return (
      <div className="page">
        <h1>{t(page.title)}</h1>
        <p className="locked-notice">{t("Complete the previous phase before starting this one.")}</p>
      </div>
    );
  }

  const allDone = page.blocks
    .flatMap((b) => b.items)
    .filter((item) => isItemVisible(item, level))
    .every((item) => isTaskDone(item.id));

  // Whole-department completion (every phase, not just this one) unlocks
  // the Completion page link — ported from isEmployeeOnboardingComplete
  // (progress.html). Reaching this point already implies every prior
  // phase is done (see the `unlocked` check above, which would have
  // returned early otherwise) — departmentComplete is just "is this the
  // last phase, and is IT also done."
  const isLastPhase = phaseIndex === content.phases.length - 1;
  const departmentComplete = isLastPhase && allDone;

  // Publish this render's completion state to the celebration hooks above
  // (they cannot compute it themselves - they run before page/level are
  // resolved). Guarded so it only sets state when the value actually
  // changes, avoiding a render loop.
  if (phaseDone !== allDone) setPhaseDone(allDone);
  if (isFinalPhase !== isLastPhase) setIsFinalPhase(isLastPhase);

  const nextPhaseTitle = page.nextPhasePage
    ? (content.phases.find((p) => `${dept.phasePrefix}-${p.dayRange}` === page.nextPhasePage)?.page
        .title ?? "")
    : "";

  return (
    <div className="page">
      <p className="eyebrow">{t(page.eyebrow)}</p>
      <h1>{t(page.title)}</h1>

      <div className="level-picker">
        <span>{t("Track")}:</span>
        <button type="button" className={level === "junior" ? "active" : ""} onClick={() => setLevel("junior")}>
          {t("Junior")}
        </button>
        <button type="button" className={level === "senior" ? "active" : ""} onClick={() => setLevel("senior")}>
          {t("Senior")}
        </button>
      </div>

      {page.blocks.map((block) => (
        <section key={block.heading} className="checklist-group">
          <h2>{t(block.heading)}</h2>
          <ul>
            {block.items
              .filter((item) => isItemVisible(item, level))
              .map((item) => (
                <li key={item.id} className={isTaskDone(item.id) ? "done" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isTaskDone(item.id)}
                      onChange={() => handleToggle(item.id)}
                    />
                    {t(item.text)}
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}

      {/* A save that failed after its retry reverted the checkbox — say so,
          otherwise the tick just silently un-ticks itself. Equivalent to the
          original app's showSaveFailedToast(). */}
      {saveError && (
        <div className="form-error" role="alert">
          {t(saveError)}{" "}
          <button type="button" onClick={dismissSaveError}>
            {t("Dismiss")}
          </button>
        </div>
      )}

      {page.closing && <p className="closing-line">{t(page.closing)}</p>}

      {page.nextPhasePage && (
        <Link
          to={`/${page.nextPhasePage}`}
          className={`cta${allDone ? " next-up" : " disabled"}`}
          aria-disabled={!allDone}
          onClick={(e) => {
            if (!allDone) e.preventDefault();
          }}
        >
          {t("Next Phase")}
          {/* Text badge, not just the .next-up styling — a colour cue alone
              conveys nothing to a screen reader. Same reasoning as the
              original app's phase trail. */}
          {allDone && <span className="next-up-badge">{t("Next up")}</span>}
        </Link>
      )}

      {!page.nextPhasePage && (
        <Link
          to="/completion"
          className={`cta${departmentComplete ? "" : " disabled"}`}
          aria-disabled={!departmentComplete}
          onClick={(e) => {
            if (!departmentComplete) e.preventDefault();
          }}
        >
          {t("Continue to Completion")}
        </Link>
      )}

      {showPhaseComplete && page.nextPhasePage && (
        <div
          className="milestone-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhaseComplete(false);
          }}
        >
          <div
            className="milestone-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="phase-complete-title"
          >
            <p className="milestone-eyebrow">{t("Phase Complete")}</p>
            <h3 id="phase-complete-title">{t(page.title)}</h3>
            <p className="milestone-sub">{t("You can now proceed to the next phase.")}</p>
            {/* No auto-dismiss timer: this card asks the employee to make a
                choice, so it waits rather than vanishing mid-decision. */}
            <Link
              to={`/${page.nextPhasePage}`}
              className="cta"
              onClick={() => setShowPhaseComplete(false)}
            >
              {nextPhaseTitle ? `${t("Start")} ${t(nextPhaseTitle)}` : t("Go to next phase")}
            </Link>
            <button type="button" className="cta secondary" onClick={() => setShowPhaseComplete(false)}>
              {t("Stay on this page")}
            </button>
          </div>
        </div>
      )}

      {pendingTaskId && <NameModal onSubmit={handleNameSubmit} />}
    </div>
  );
}
