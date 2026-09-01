
// Ported verbatim from the original app's progress.html DEPARTMENTS array.
// This is the flat identity list (label/prefix/head-of-department) used by
// the name modal's department dropdown. Content lives separately in
// allDepartments.ts (ALL_DEPARTMENTS), which pairs each department with its
// real phase content — all five are fully ported there; an earlier version
// of this comment claimed only Finance was, which is no longer true.
export const DEPARTMENTS = [
  {
    id: "accounting",
    label: "Accounting Team",
    shortLabel: "Accounting",
    prefix: "accounting-",
    landingPage: "accounting-team",
    headOfDept: "Mrs. Wanpen Yamploy, Head of Accounting",
  },
  {
    id: "finance",
    label: "Finance Team",
    shortLabel: "Finance",
    prefix: "finance-",
    landingPage: "finance-team",
    headOfDept: "Mr. Vivich Chavananand, Head of Finance",
  },
  {
    id: "procurement",
    label: "Procurement Team",
    shortLabel: "Procurement",
    prefix: "procurement-",
    landingPage: "procurement-team",
    headOfDept: "Mrs. Thongthip Chavananand, Head of Procurement",
  },
  {
    id: "property",
    label: "Property & Asset Management",
    shortLabel: "Property",
    prefix: "property-",
    landingPage: "property-asset-management",
    headOfDept: "Mr. Watcharit Chavananand, Head of Asset Management",
  },
  {
    id: "engineering",
    label: "Engineering Team",
    shortLabel: "Engineering",
    prefix: "engineering-",
    landingPage: "engineering-team",
    headOfDept: "Mr. Vivat Chavananand, Head of Engineering",
  },
];
