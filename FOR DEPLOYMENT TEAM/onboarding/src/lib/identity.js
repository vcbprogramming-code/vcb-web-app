// Name-only identity, ported from the original app's progress.html.
//
// This is NOT authentication and is not meant to become it. New hires use this
// module on their first day, before anyone has created an account for them, so
// identity is a name typed into a box and kept in localStorage — exactly what
// the Apps Script version did, and what api/src/routes/onboarding.js is built
// around (allowAnonymous, every write scoped to one named employee).
//
// Real sign-in exists in this module for ONE thing: the admin checklist editor
// and the cohort view, which are gated on the portal admin role via
// AuthProvider from @vcb/shared. Do not extend that gate over the employee
// flows — it would lock out the people the module exists for.

const NAME_KEY = 'vcb-employee-name';
const DEPARTMENT_KEY = 'vcb-employee-department';
const LEVEL_KEY = 'vcb-employee-level';

export function getEmployeeName() {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setEmployeeName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage unavailable (private browsing, blocked site data) — the
    // same best-effort behaviour as the original app. The session simply does
    // not survive a reload.
  }
}

export function getEmployeeDepartment() {
  try {
    return localStorage.getItem(DEPARTMENT_KEY);
  } catch {
    return null;
  }
}

export function setEmployeeDepartment(deptId) {
  try {
    localStorage.setItem(DEPARTMENT_KEY, deptId);
  } catch {
    // best-effort, same as above
  }
}

/** @returns {'junior'|'senior'} */
export function getEmployeeLevel() {
  try {
    return localStorage.getItem(LEVEL_KEY) === 'senior' ? 'senior' : 'junior';
  } catch {
    return 'junior';
  }
}

export function setEmployeeLevel(level) {
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // best-effort, same as above
  }
}
