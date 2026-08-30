import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  getEmployeeDepartment,
  getEmployeeLevel,
  getEmployeeName,
  setEmployeeDepartment as persistDepartment,
  setEmployeeLevel as persistLevel,
  setEmployeeName as persistName,
} from "./identity";

// Ported from the original app's progress.html: PROGRESS_CACHE (an
// in-memory taskId -> true map) plus loadProgress()/setTaskDone(), now
// backed by Supabase instead of a Google Sheet via google.script.run.
// syncTaskDone's retry-then-revert-on-failure behavior (see the original
// app's docs/ARCHITECTURE.md "Progress cache" section) is ported as-is —
// a failed save shouldn't leave a checkbox visually checked with nothing
// actually saved, silently.

export function useProgress() {
  const [name, setNameState] = useState<string | null>(getEmployeeName);
  const [department, setDepartmentState] = useState<string | null>(getEmployeeDepartment);
  const [level, setLevelState] = useState(getEmployeeLevel);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  // No name yet means there's nothing to load — known synchronously at
  // first render, so it's the initial state rather than something an
  // effect needs to set on mount. Once identify() sets a real name, the
  // effect below flips this back to false for the duration of that real
  // fetch (it must — `loaded` gates the UI's loading state, and staying
  // `true` from this initializer would let stale/empty progress render
  // as if it were the confirmed final state while the fetch is still in
  // flight).
  const [loaded, setLoaded] = useState(() => !getEmployeeName());
  // Non-null when the last progress fetch failed, so the UI can say so
  // rather than silently showing an empty checklist. See the failure
  // branch in the effect below.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Non-null when a save ultimately failed after its retry — the React
  // equivalent of the original app's showSaveFailedToast().
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setLoaded(false);
    supabase
      .from("progress")
      .select("task_id, completed")
      .eq("employee_name", name)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Do NOT setLoaded(true) here. Doing so rendered a transient
          // network failure as a fully-unchecked checklist — visually
          // identical to a genuinely new employee — so an employee would
          // re-tick boxes on top of saved state they couldn't see, and it
          // never retried. Leaving `loaded` false keeps the UI in its
          // loading state and lets the next mount genuinely retry, and
          // loadError surfaces a real message instead of a console log
          // nobody reads. Ported from the original app's loadProgress fix
          // (see ORIGINAL CODE/docs/ARCHITECTURE.md, "Progress cache").
          console.error("Failed to load progress:", error);
          setLoadError("Could not load your saved progress. Please reload before continuing.");
          return;
        }
        setLoadError(null);
        const next: Record<string, boolean> = {};
        for (const row of data ?? []) {
          if (row.completed) next[row.task_id] = true;
        }
        setProgress(next);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const identify = useCallback(async (employeeName: string, deptId: string) => {
    persistName(employeeName);
    persistDepartment(deptId);
    setNameState(employeeName);
    setDepartmentState(deptId);
    // Upsert so a returning employee's row isn't clobbered back to
    // defaults — mirrors the original app's employees table being the
    // durable record of who's onboarding and in which department.
    const { error } = await supabase
      .from("employees")
      .upsert({ name: employeeName, department: deptId }, { onConflict: "name" });
    if (error) console.error("Failed to save employee identity:", error);
  }, []);

  const setLevel = useCallback(async (newLevel: "junior" | "senior") => {
    persistLevel(newLevel);
    setLevelState(newLevel);
    const employeeName = getEmployeeName();
    if (!employeeName) return;
    const { error } = await supabase
      .from("employees")
      .update({ level: newLevel })
      .eq("name", employeeName);
    if (error) console.error("Failed to save employee level:", error);
  }, []);

  const isTaskDone = useCallback((taskId: string) => !!progress[taskId], [progress]);

  const toggleTask = useCallback(
    async (taskId: string) => {
      const employeeName = getEmployeeName();
      if (!employeeName) return;
      const newState = !progress[taskId];
      // Optimistic update first, same as the original app's performToggle.
      setProgress((prev) => ({ ...prev, [taskId]: newState }));

      async function attempt(isRetry: boolean): Promise<void> {
        const { error } = await supabase
          .from("progress")
          .upsert(
            { employee_name: employeeName, task_id: taskId, completed: newState, updated_at: new Date().toISOString() },
            { onConflict: "employee_name,task_id" },
          );
        if (!error) return;
        if (!isRetry) {
          await attempt(true);
          return;
        }
        // Final failure: revert, matching the original app's
        // syncTaskDone — never let a checkbox look saved when it isn't.
        console.error("Failed to save task progress after retry:", error);
        setProgress((prev) => ({ ...prev, [taskId]: !newState }));
        setSaveError("Could not save — please try again.");
      }
      await attempt(false);
    },
    [progress],
  );

  /* Correcting a typo'd name. A mistyped name silently starts a fresh,
     empty progress record (the server cannot tell a typo from a genuinely
     new employee), so this MUST carry the existing rows over rather than
     just rewriting localStorage, which would orphan them and present an
     empty checklist. Ported from the original app's renameEmployee
     (Code.gs) + promptToChangeName (progress.html).

     If rows already exist under the target name — the employee is merging
     a typo back onto their real record — the two are unioned: a task
     completed under either spelling stays completed. */
  const renameEmployee = useCallback(
    async (nextName: string): Promise<boolean> => {
      const current = getEmployeeName();
      const trimmed = nextName.trim();
      if (!current || !trimmed || trimmed === current) return false;

      const { data: existing, error: readErr } = await supabase
        .from("progress")
        .select("task_id, completed")
        .eq("employee_name", trimmed);
      if (readErr) {
        console.error("Rename: failed to read target rows:", readErr);
        setSaveError("Could not update your name. Please try again.");
        return false;
      }

      const alreadyDone = new Set(
        (existing ?? []).filter((r) => r.completed).map((r) => r.task_id),
      );
      // Union: anything done under the old name should end up done under
      // the new one, without un-completing what the target already had.
      const merged = Object.entries(progress)
        .filter(([, done]) => done)
        .map(([taskId]) => taskId)
        .concat([...alreadyDone]);
      const rows = [...new Set(merged)].map((taskId) => ({
        employee_name: trimmed,
        task_id: taskId,
        completed: true,
        updated_at: new Date().toISOString(),
      }));

      if (rows.length) {
        const { error: upErr } = await supabase
          .from("progress")
          .upsert(rows, { onConflict: "employee_name,task_id" });
        if (upErr) {
          console.error("Rename: failed to write merged rows:", upErr);
          setSaveError("Could not update your name. Please try again.");
          return false;
        }
      }
      // Only delete the old rows once the new ones are safely written —
      // a failure above leaves the original record untouched.
      const { error: delErr } = await supabase
        .from("progress")
        .delete()
        .eq("employee_name", current);
      if (delErr) console.error("Rename: old rows left behind:", delErr);

      const { error: empErr } = await supabase
        .from("employees")
        .upsert({ name: trimmed, department, level }, { onConflict: "name" });
      if (empErr) console.error("Rename: failed to move employee row:", empErr);
      await supabase.from("employees").delete().eq("name", current);

      persistName(trimmed);
      setNameState(trimmed);
      setSaveError(null);
      return true;
    },
    [progress, department, level],
  );

  /* Switching department discards the old department's progress, matching
     the original app's switchDepartment/clearDepartmentProgress. The
     original had a real bug here worth not repeating: it matched task ids
     against the PAGE-key prefix ("accounting-") while ids on the server
     use the abbreviated scheme ("acct-p1-know-3"), so it silently deleted
     nothing and the old checkmarks reappeared on the next load. Here the
     ids to delete come from the department's own content, so there is no
     prefix string to get wrong. */
  const switchDepartment = useCallback(
    async (nextDeptId: string, oldDeptTaskIds: string[]) => {
      const employeeName = getEmployeeName();
      persistDepartment(nextDeptId);
      setDepartmentState(nextDeptId);
      setProgress((prev) => {
        const next = { ...prev };
        for (const id of oldDeptTaskIds) delete next[id];
        return next;
      });
      if (!employeeName) return;
      if (oldDeptTaskIds.length) {
        const { error } = await supabase
          .from("progress")
          .delete()
          .eq("employee_name", employeeName)
          .in("task_id", oldDeptTaskIds);
        if (error) {
          console.error("Failed to clear previous department's progress:", error);
          setSaveError(
            "Could not clear your previous department's saved progress. It may reappear — please tell HR.",
          );
        }
      }
      const { error: empErr } = await supabase
        .from("employees")
        .upsert({ name: employeeName, department: nextDeptId }, { onConflict: "name" });
      if (empErr) console.error("Failed to save new department:", empErr);
    },
    [],
  );

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
