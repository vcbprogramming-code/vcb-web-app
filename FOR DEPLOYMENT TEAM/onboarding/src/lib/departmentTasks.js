// Every task id that belongs to one department's checklist — ported from
// getDepartmentTaskIds() in progress.html. Used to tell whether an employee
// has actually started their current department (any of these ids marked
// done) before a department switch is allowed to silently discard anything,
// and to drive the overall-progress percentage (see ProgressBar.jsx).
//
// Filtered by isItemVisible(level): the original counted Senior-only items
// unconditionally here, unlike getPageTaskIds, which left a Junior who
// finished everything actually required of them stuck below 100% ("27/36
// tasks complete") because the denominator kept counting Senior-only tasks
// they were never asked to do. `level` defaults to 'junior' (the strictest
// filter) so an omitted level can't silently over-count either.

import { ALL_DEPARTMENTS } from '../data/allDepartments.js';

function isItemVisible(item, level) {
  return item.level !== 'senior' || level === 'senior';
}

export function getDepartmentTaskIds(deptId, level = 'junior') {
  const dept = ALL_DEPARTMENTS.find((d) => d.id === deptId);
  if (!dept) return [];
  return dept.content.phases.flatMap((phase) =>
    phase.page.blocks.flatMap((block) =>
      block.items.filter((item) => isItemVisible(item, level)).map((item) => item.id)
    )
  );
}

export function hasStartedDepartment(deptId, isTaskDone) {
  // Unaffected by level: "any task done" is a superset-safe check either way.
  return getDepartmentTaskIds(deptId, 'senior').some((id) => isTaskDone(id));
}
