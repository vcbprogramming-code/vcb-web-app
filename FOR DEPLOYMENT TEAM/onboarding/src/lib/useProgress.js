// The employee's identity and their ticked checkboxes.
//
// Ported from the original app's progress.html (PROGRESS_CACHE plus
// loadProgress/setTaskDone), and rewired from direct Supabase access to the
// Express API — the browser no longer holds database credentials.
//
// Two behaviours from the original are load-bearing and must not be
// "simplified" away:
//
//   * A FAILED LOAD LEAVES `loaded` FALSE. Setting it true rendered a
//     transient network failure as a fully-unchecked checklist, visually
//     identical to a genuinely new employee, so people re-ticked boxes on top
//     of saved state they could not see. `loadError` carries the reason so the
//     UI can say so instead of spinning.
//   * A FAILED SAVE REVERTS THE CHECKBOX after one retry. Never leave a tick
//     looking saved when nothing was written.
//
// Error state is exposed as TRANSLATION KEYS, not prose: the API returns
// machine-readable codes and the UI renders Thai or English through t().

import { useCallback, useEffect, useState } from 'react';
import {
  getProgress,
  saveEmployee,
  setTaskDone as apiSetTaskDone,
  updateEmployee,
  renameEmployee as apiRenameEmployee,
  switchDepartment as apiSwitchDepartment,
} from './onboardingApi.js';
import {
  getEmployeeDepartment,
  getEmployeeLevel,
  getEmployeeName,
  setEmployeeDepartment as persistDepartment,
  setEmployeeLevel as persistLevel,
  setEmployeeName as persistName,
} from './identity.js';

export function useProgress() {
  const [name, setNameState] = useState(getEmployeeName);
  const [department, setDepartmentState] = useState(getEmployeeDepartment);
  const [level, setLevelState] = useState(getEmployeeLevel);
  const [progress, setProgress] = useState({});
  // No name yet means there is nothing to load — known synchronously at first
  // render, so it is the initial state rather than something an effect must
  // set on mount. Once identify() sets a real name the effect below flips this
  // back to false for the duration of that real fetch; it must, because
  // `loaded` gates the UI's loading state and staying true here would let an
  // empty progress map render as the confirmed final state mid-flight.
  const [loaded, setLoaded] = useState(() => !getEmployeeName());
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!name) return undefined;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const data = await getProgress(name);
        if (cancelled) return;
        const next = {};
        for (const row of data?.rows ?? []) {
          if (row.completed) next[row.task_id] = true;
        }
        setLoadError(null);
        setProgress(next);
        setLoaded(true);
      } catch (err) {
        if (cancelled) return;
        // 404 is not a failure — it means this name has no record yet, which
        // is the normal state for a genuinely new employee. The API returns it
        // deliberately so that "nothing saved" and "could not load" stay
        // distinguishable, which an empty array would not.
        if (err?.status === 404) {
          setLoadError(null);
          setProgress({});
          setLoaded(true);
          return;
        }
        // Anything else: do NOT set loaded. See the header note — this keeps
        // the UI in its loading state, lets the next mount genuinely retry,
        // and surfaces a real message.
        setLoadError('progress.loadFailed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name]);

  /** Register the employee, and their department if it is already known.
   *  Upsert, so a returning employee lands back on their own record instead
   *  of being reset.
   *
   *  deptId is OPTIONAL — a pre-boarding action (a Required Documents
   *  checkbox, say) happens before Department Selection in the journey, and
   *  the original app's own promptForNameOnly() never asked for a department
   *  at that point: forcing the choice early would just make the person pick
   *  it twice, once here and once for real at Department Selection. */
  const identify = useCallback(async (employeeName, deptId) => {
    const trimmed = employeeName.trim();
    persistName(trimmed);
    setNameState(trimmed);
    if (deptId) {
      persistDepartment(deptId);
      setDepartmentState(deptId);
    }
    try {
      await saveEmployee({ name: trimmed, department: deptId || undefined });
    } catch {
      // The name is already in localStorage and the progress effect will run;
      // a failed upsert here surfaces on the first checkbox instead, where
      // there is somewhere to show it.
      setSaveError('progress.saveFailed');
    }
  }, []);

  const setLevel = useCallback(async (newLevel) => {
    persistLevel(newLevel);
    setLevelState(newLevel);
    const employeeName = getEmployeeName();
    if (!employeeName) return;
    try {
      await updateEmployee(employeeName, { level: newLevel });
    } catch {
      setSaveError('progress.saveFailed');
    }
  }, []);

  const isTaskDone = useCallback((taskId) => !!progress[taskId], [progress]);

  const toggleTask = useCallback(
    async (taskId) => {
      const employeeName = getEmployeeName();
      if (!employeeName) return;
      const newState = !progress[taskId];
      // Optimistic first, same as the original app's performToggle.
      setProgress((prev) => ({ ...prev, [taskId]: newState }));

      const attempt = async (isRetry) => {
        try {
          await apiSetTaskDone(employeeName, taskId, newState);
        } catch (err) {
          if (!isRetry) {
            await attempt(true);
            return;
          }
          // Final failure: revert, matching the original app's syncTaskDone.
          // A checkbox must never look saved when it is not.
          setProgress((prev) => ({ ...prev, [taskId]: !newState }));
          setSaveError(err?.status === 409 ? 'progress.unknownEmployee' : 'progress.saveFailed');
        }
      };
      await attempt(false);
    },
    [progress]
  );

  /**
   * Correct a mistyped name.
   *
   * One API call now. The server moves the employee row and unions the
   * progress in a single transaction, so a task completed under either
   * spelling stays completed and a failure part-way leaves the original record
   * intact. The client used to do this as three unsynchronised round trips.
   */
  const renameEmployee = useCallback(async (nextName) => {
    const current = getEmployeeName();
    const trimmed = nextName.trim();
    if (!current || !trimmed || trimmed === current) return false;
    try {
      await apiRenameEmployee(current, trimmed);
    } catch {
      setSaveError('progress.renameFailed');
      return false;
    }
    persistName(trimmed);
    setNameState(trimmed);
    setSaveError(null);
    return true;
  }, []);

  /**
   * Switch department, discarding the old department's progress.
   *
   * `oldDeptTaskIds` comes from the old department's own content because the
   * API does not have it. See onboardingApi.switchDepartment for why prefix
   * matching must not come back.
   */
  const switchDepartment = useCallback(async (nextDeptId, oldDeptTaskIds = []) => {
    const employeeName = getEmployeeName();
    persistDepartment(nextDeptId);
    setDepartmentState(nextDeptId);
    setProgress((prev) => {
      const next = { ...prev };
      for (const id of oldDeptTaskIds) delete next[id];
      return next;
    });
    if (!employeeName) return;
    try {
      await apiSwitchDepartment(employeeName, nextDeptId, oldDeptTaskIds);
    } catch {
      setSaveError('progress.switchDepartmentFailed');
    }
  }, []);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  return {
    name,
    department,
    level,
    loaded,
    loadError,
    saveError,
    dismissSaveError,
    isTaskDone,
    toggleTask,
    identify,
    setLevel,
    renameEmployee,
    switchDepartment,
  };
}
