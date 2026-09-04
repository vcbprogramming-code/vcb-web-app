
// Ported verbatim from the original app's progress.html DEPARTMENTS array.
// This is the flat identity list (label/prefix/head-of-department) used by
// the name modal's department dropdown. Content lives separately in
// allDepartments.ts (ALL_DEPARTMENTS), which pairs each department with its
// real phase content — all five are fully ported there; an earlier version
// of this comment claimed only Finance was, which is no longer true.
//
// deptCard, desc, focus, and icon are the deptgrid section's own fields
// (content.html's `depts` array, Department Selection on the pre-boarding
// page) — a card's label there is its own ("Asset Management Team"), which
// differs on purpose from this list's page-title label ("Property & Asset
// Management") for the "property" row, matching the original exactly.
export const DEPARTMENTS = [
  {
    id: "accounting",
    label: "Accounting Team",
    shortLabel: "Accounting",
    prefix: "accounting-",
    landingPage: "accounting-team",
    headOfDept: "Mrs. Wanpen Yamploy, Head of Accounting",
    deptCard: {
      label: "Accounting Team",
      icon: "ledger",
      desc: "Keep the company’s financial records complete, transparent, and audit-ready.",
      focus: "Recording, tax compliance, audit readiness",
    },
  },
  {
    id: "finance",
    label: "Finance Team",
    shortLabel: "Finance",
    prefix: "finance-",
    landingPage: "finance-team",
    headOfDept: "Mr. Vivich Chavananand, Head of Finance",
    deptCard: {
      label: "Finance Team",
      icon: "coin",
      desc: "Protect liquidity and long-term financial stability through controlled cashflow.",
      focus: "Cashflow, financing, debt management",
    },
  },
  {
    id: "procurement",
    label: "Procurement Team",
    shortLabel: "Procurement",
    prefix: "procurement-",
    landingPage: "procurement-team",
    headOfDept: "Mrs. Thongthip Chavananand, Head of Procurement",
    deptCard: {
      label: "Procurement Team",
      icon: "package",
      desc: "Secure materials and services on terms that protect cost, schedule, and quality.",
      focus: "Sourcing, supplier risk, approvals",
    },
  },
  {
    id: "property",
    label: "Property & Asset Management",
    shortLabel: "Property",
    prefix: "property-",
    landingPage: "property-asset-management",
    headOfDept: "Mr. Watcharit Chavananand, Head of Asset Management",
    deptCard: {
      label: "Asset Management Team",
      icon: "building",
      desc: "Track and safeguard every company-owned asset, from tools to heavy equipment.",
      focus: "Registration, tracking, verification",
    },
  },
  {
    id: "engineering",
    label: "Engineering Team",
    shortLabel: "Engineering",
    prefix: "engineering-",
    landingPage: "engineering-team",
    headOfDept: "Mr. Vivat Chavananand, Head of Engineering",
    deptCard: {
      label: "Engineering Team",
      icon: "wrench",
      desc: "Turn project progress into certified, accurately measured revenue on site.",
      focus: "Execution, measurement, documentation",
    },
  },
];
