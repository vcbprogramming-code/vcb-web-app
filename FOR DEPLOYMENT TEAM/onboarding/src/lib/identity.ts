// Ported from the original app's progress.html — name-only identity, no
// real auth (see React/README.md's "Auth" section for why this is a
// deliberate scope decision for the scaffold, matching current behavior).

const NAME_KEY = "vcb-employee-name";
const DEPARTMENT_KEY = "vcb-employee-department";
const LEVEL_KEY = "vcb-employee-level";

export type EmployeeLevel = "junior" | "senior";

export function getEmployeeName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setEmployeeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage unavailable (private browsing, etc.) — same
    // best-effort behavior as the original app.
  }
}

export function getEmployeeDepartment(): string | null {
  try {
    return localStorage.getItem(DEPARTMENT_KEY);
  } catch {
    return null;
  }
}

export function setEmployeeDepartment(deptId: string): void {
  try {
    localStorage.setItem(DEPARTMENT_KEY, deptId);
  } catch {
    // best-effort, same as above
  }
}

export function getEmployeeLevel(): EmployeeLevel {
  try {
    return (localStorage.getItem(LEVEL_KEY) as EmployeeLevel) || "junior";
  } catch {
    return "junior";
  }
}

export function setEmployeeLevel(level: EmployeeLevel): void {
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // best-effort, same as above
  }
}
