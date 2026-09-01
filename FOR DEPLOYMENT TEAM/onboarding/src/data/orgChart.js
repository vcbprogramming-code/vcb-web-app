// Ported verbatim from the original app's content.html — the `type: 'orgchart'`
// section inside PAGES['home'] (Company Structure). All names are random
// placeholders (real names removed per the original app's own request); every
// role/title/description string is transcribed byte-for-byte from the source.
//
// This file carries pure content/data only — no rendering logic. See
// content.html's own inline comments (preserved in spirit below) for the
// structural rationale behind each shape (e.g. why Asset Management uses
// `branches` instead of `members`, why opsDepartments/adminDepartments are one
// shared template applied to every project, why Group Structure separates
// shareholders/parent/subsidiaries/jvs/familyCompanies).

/**
 * Shapes for the org-chart content below. TECH_STACK.md rules out TypeScript,
 * so these are JSDoc typedefs rather than interfaces — same documentation, no
 * compile step.
 *
 * @typedef {{ name: string, role?: string }} OrgPerson
 * @typedef {{ id: string, label: string, members: OrgPerson[] }} OrgTeam
 * @typedef {{ id: string, label: string, members: OrgPerson[], offsite?: boolean, location?: string }} OrgTeamBranch
 * @typedef {{ id: string, label: string, branches: OrgTeamBranch[] }} OrgTeamBranches
 * @typedef {{ heading: string, members: OrgPerson[] }} LeadershipLevel
 * @typedef {{ id: string, label: string, levels: LeadershipLevel[] }} Leadership
 * @typedef {{ label: string, lead: OrgPerson, staff: OrgPerson[], hqDept?: string }} ProjectDept
 * @typedef {{ id: string, label: string, lead: OrgPerson, opsDepartments: ProjectDept[], adminDepartments: ProjectDept[] }} Project
 * @typedef {{ id: string, label: string, projects: Project[] }} ProjectManagers
 * @typedef {{ id: string, label: string }} GroupShareholder
 * @typedef {{ id: string, label: string, sub: string }} GroupEntity
 * @typedef {{ id: string, label: string, parents: string[] }} GroupJointVenture
 */

// Shared description reused across every Project Manager — every PM at every
// site does the same job (2026-08 correction in the original app).
const PM_ROLE =
  "Oversees all site execution and staffing, coordinating day-to-day between Site Operations and Site Administration.";

export const LEADERSHIP = {
  id: "leadership",
  label: "Leadership",
  levels: [
    {
      heading: "Board of Directors",
      members: [
        { name: "Mr. Somchai Placeholder", role: "Director" },
        { name: "Mr. Anurak Placeholder", role: "Director" },
        { name: "Mr. Kittipong Placeholder", role: "Director" },
        { name: "Mrs. Suchada Placeholder", role: "Director" },
      ],
    },
    {
      heading: "Board Advisors",
      members: [
        { name: "Mr. Prasert Placeholder", role: "Advisor to the Board" },
        { name: "Mr. Somkiat Placeholder", role: "Advisor to the Board" },
      ],
    },
    {
      heading: "Managing Director",
      members: [
        {
          name: "Mr. Somchai Placeholder",
          role: "Managing Director — sets company direction and owns the final call on every major decision.",
        },
      ],
    },
    {
      heading: "Assistant Managing Directors",
      members: [
        {
          name: "Mr. Kittipong Placeholder",
          role: "Assistant Managing Director — oversees day-to-day operations across all departments.",
        },
        {
          name: "Mr. Narong Placeholder",
          role: "Assistant Managing Director — leads strategic planning and cross-department coordination.",
        },
      ],
    },
  ],
};

// Departments segment — every functional team except Project Managers (see
// PROJECT_MANAGERS below), per the real org chart's site/HQ separation.
// Named DEPARTMENTS_ORG to avoid colliding with the onboarding `Department`
// type/array in types.ts / departments data.
export const DEPARTMENTS_ORG = [
  {
    id: "engineering",
    label: "Engineering Team",
    members: [
      {
        name: "Mr. Thanawat Placeholder",
        role: "Head of Engineering — owns execution accuracy and revenue realization.",
      },
      {
        name: "Mr. Pichai Placeholder",
        role: "Reviews site progress against approved drawings and specifications.",
      },
      {
        name: "Mrs. Malee Placeholder",
        role: "Senior Engineer Officer — coordinates measurement and progress documentation.",
      },
      {
        name: "Mr. Somsak Placeholder",
        role: "Tracks material and labor efficiency across active sites.",
      },
      {
        name: "Mr. Wichai Placeholder",
        role: "Prepares documentation supporting progress claims.",
      },
      {
        name: "Mrs. Ratana Placeholder",
        role: "Coordinates schedules between Engineering and Project Management.",
      },
    ],
  },
  {
    id: "accounting",
    label: "Accounting Team",
    members: [
      {
        name: "Mrs. Pranee Placeholder",
        role: "Head of Accounting — owns documentation discipline and audit readiness.",
      },
      {
        name: "Mrs. Siriporn Placeholder",
        role: "Accounting Assistant — supports new employee onboarding and daily postings.",
      },
      {
        name: "Ms. Kanya Placeholder",
        role: "Handles AP/AR posting and invoice verification.",
      },
      {
        name: "Ms. Orapin Placeholder",
        role: "Manages VAT and withholding tax reconciliation.",
      },
      {
        name: "Ms. Duangjai Placeholder",
        role: "Maintains the Chart of Accounts and journal entry accuracy.",
      },
      {
        name: "Ms. Nittaya Placeholder",
        role: "Prepares monthly reconciliation reports.",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance Team",
    members: [
      {
        name: "Mr. Chatchai Placeholder",
        role: "Head of Finance — safeguards liquidity and long-term financial stability.",
      },
      {
        name: "Mrs. Sunisa Placeholder",
        role: "Senior Finance Officer — monitors cashflow and funding requirements.",
      },
      {
        name: "Ms. Waraporn Placeholder",
        role: "Manages banking facilities and financing instruments.",
      },
      {
        name: "Mr. Anucha Placeholder",
        role: "Tracks debt servicing capacity and liquidity exposure.",
      },
    ],
  },
  // Asset Management splits into two branches (not a flat member list like
  // every other department): Inventory & Land stays at Head Office; Vehicles
  // & Machinery sits physically off-site (Sai-5) but is organizationally
  // still part of Asset Management, not a separate department.
  {
    id: "asset",
    label: "Asset Management",
    branches: [
      {
        id: "asset-inventory",
        label: "Inventory & Land",
        members: [
          {
            name: "Mr. Prayut Placeholder",
            role: "Head of Asset Management — protects company-owned assets and inventory integrity.",
          },
          {
            name: "Mr. Somboon Placeholder",
            role: "Conducts periodic physical verification of site equipment.",
          },
          {
            name: "Ms. Ampha Placeholder",
            role: "Maintains asset registration and warehouse movement records for inventory, land, and non-vehicle assets.",
          },
        ],
      },
      {
        id: "asset-sai5",
        label: "Vehicles & Machinery",
        offsite: true,
        location: "Sai-5",
        members: [
          {
            name: "Mr. Wichit Placeholder",
            role: "Head of Vehicles & Machinery — keeps the fleet and heavy equipment mission-ready.",
          },
          {
            name: "Mr. Utiss Placeholder",
            role: "Coordinates preventive maintenance schedules for the vehicle and machinery fleet.",
          },
          {
            name: "Mr. Sombat Placeholder",
            role: "Diagnoses and repairs heavy equipment mechanical faults.",
          },
          {
            name: "Mr. Kriangsak Placeholder",
            role: "Maintains fleet vehicle service records and parts inventory.",
          },
        ],
      },
    ],
  },
  {
    id: "procurement",
    label: "Procurement Team",
    members: [
      {
        name: "Mrs. Ladda Placeholder",
        role: "Head of Procurement — protects cost structure and supply reliability.",
      },
      {
        name: "Mrs. Wilai Placeholder",
        role: "Senior Procurement Officer — evaluates supplier risk and terms.",
      },
      {
        name: "Ms. Chalida Placeholder",
        role: "Processes purchase requests and purchase orders.",
      },
      {
        name: "Ms. Piyanuch Placeholder",
        role: "Coordinates delivery schedules with project timelines.",
      },
    ],
  },
  {
    id: "hr",
    label: "Human Resources",
    members: [
      {
        name: "Mrs. Ratree Placeholder",
        role: "Leads recruitment, onboarding, and employee relations.",
      },
      {
        name: "Ms. Suwanna Placeholder",
        role: "Handles HR documentation and new employee support.",
      },
    ],
  },
];

// Administration — placeholder team, rendered as one more card inside the
// Head Office band (same plane as Engineering, Accounting, etc.), not its
// own separate segment. Names/roles are generic placeholders, not real
// staff, pending real data.
export const ADMINISTRATION = {
  id: "administration",
  label: "Administration",
  members: [
    {
      name: "Mrs. Placeholder One",
      role: "Head of Administration — placeholder role description.",
    },
    { name: "Mr. Placeholder Two", role: "Placeholder role description." },
    { name: "Ms. Placeholder Three", role: "Placeholder role description." },
    { name: "Mr. Placeholder Four", role: "Placeholder role description." },
    { name: "Ms. Placeholder Five", role: "Placeholder role description." },
    { name: "Mr. Placeholder Six", role: "Placeholder role description." },
  ],
};

// Site Operations — reports to the Project Manager (solid line, the normal
// project hierarchy), broken into named sub-departments. Shared across all
// projects via this one template since no real per-project staffing data
// exists in this app.
const opsDepartments = [
  {
    label: "Budgeting / Shop Drawing",
    lead: { name: "Mr. Somjit Placeholder", role: "Design & Budgeting Engineer" },
    staff: [
      { name: "Mr. Kittisak Placeholder", role: "Quantity Surveyor" },
      { name: "Mr. Anucha Placeholder", role: "Draftsman" },
    ],
  },
  {
    label: "Survey",
    lead: { name: "Mr. Preecha Placeholder", role: "Survey Engineer" },
    staff: [
      { name: "Mr. Somsak Placeholder", role: "Survey Technician" },
      { name: "Mr. Wichai Placeholder", role: "Survey Technician" },
    ],
  },
  {
    label: "Structural & Bridge Works",
    lead: { name: "Mr. Amnat Placeholder", role: "Construction Supervisor Engineer" },
    staff: [
      { name: "Mr. Direk Placeholder", role: "Foreman" },
      { name: "Mr. Boonchu Placeholder", role: "Foreman" },
    ],
  },
  {
    label: "Roadworks / Drainage Systems",
    lead: { name: "Mr. Kamon Placeholder", role: "Construction Supervisor Engineer" },
    staff: [
      { name: "Mr. Ratana Placeholder", role: "Foreman" },
      { name: "Mr. Sompong Placeholder", role: "Equipment Operator" },
    ],
  },
  {
    label: "Safety / Traffic Control",
    lead: { name: "Mr. Winai Placeholder", role: "Professional Safety Officer" },
    staff: [
      { name: "Mr. Ekachai Placeholder", role: "Traffic Control Officer" },
      { name: "Mr. Pravit Placeholder", role: "Traffic Control Officer" },
    ],
  },
];

// Site Administration — a matrix reporting line, not a normal
// chain-of-command one: physically placed at the project site to handle
// documents/internal-audit support for daily operations, but each person's
// actual reporting line runs to the matching HQ department (hqDept) for
// whichever function they're doing, NOT to the Project Manager.
const adminDepartments = [
  {
    label: "Maintenance",
    lead: { name: "Mr. Suriya Placeholder", role: "Maintenance Supervisor" },
    hqDept: "asset",
    staff: [
      { name: "Mr. Anan Placeholder", role: "Electrician" },
      { name: "Mr. Sakda Placeholder", role: "Mechanic" },
    ],
  },
  {
    label: "Supplies & Asset Management",
    lead: { name: "Mr. Thawee Placeholder", role: "Supplies & Asset Officer" },
    hqDept: "asset",
    staff: [
      { name: "Mr. Pichit Placeholder", role: "Store Officer" },
      { name: "Mr. Charnwit Placeholder", role: "Store Officer" },
    ],
  },
  {
    label: "Accounting - Finance - Procurement",
    lead: { name: "Ms. Areeya Placeholder", role: "Site Accounting & Procurement Officer" },
    hqDept: "accounting",
    staff: [
      { name: "Ms. Kanya Placeholder", role: "Accounting Officer" },
      { name: "Ms. Duangjai Placeholder", role: "Procurement Officer" },
    ],
  },
  {
    label: "HR - Administration",
    lead: { name: "Ms. Rungnapa Placeholder", role: "Site HR & Administration Officer" },
    hqDept: "procurement",
    staff: [
      { name: "Ms. Siriporn Placeholder", role: "HR Officer" },
      { name: "Ms. Malee Placeholder", role: "Admin Officer" },
    ],
  },
];

// Project Sites — the 5 projects render directly under the "Project Sites"
// segment. opsDepartments/adminDepartments are one shared template applied
// to every project (same objects reused, matching the original app's
// `.map(function (p) {...})` construction).
export const PROJECTS = [
  { id: "proj-a", label: "Project A", lead: { name: "Mr. Decha Placeholder", role: PM_ROLE } },
  { id: "proj-b", label: "Project B", lead: { name: "Mr. Nattapong Placeholder", role: PM_ROLE } },
  { id: "proj-c", label: "Project C", lead: { name: "Mr. Sittichai Placeholder", role: PM_ROLE } },
  { id: "proj-d", label: "Project D", lead: { name: "Mr. Boonmee Placeholder", role: PM_ROLE } },
  { id: "proj-e", label: "Project E", lead: { name: "Mr. Charoen Placeholder", role: PM_ROLE } },
].map((p) => ({
  id: p.id,
  label: p.label,
  lead: p.lead,
  opsDepartments,
  adminDepartments,
}));

export const PROJECT_MANAGERS = {
  id: "pm",
  label: "Project Managers",
  projects: PROJECTS,
};

// Group structure — Vichitbhan's position within the wider Vichitbhan Group:
// who OWNS Vichitbhan (shareholders), sibling family-owned companies at the
// same tier (familyCompanies), and what Vichitbhan itself owns/co-owns
// (subsidiaries, joint ventures).
export const GROUP_STRUCTURE = {
  groupName: "Vichitbhan Group",
  shareholders: [{ id: "chavananand", label: "Chavananand Family" }],
  parent: {
    id: "vcb",
    label: "Vichitbhan Construction Co., Ltd.",
    sub: "Vichitbhan Construction Company Limited (VCB) is a construction company specializing in large-scale infrastructure projects, including highways, roads, dams, and precast concrete works. The company primarily serves government and public-sector clients, delivering construction projects through its engineering, project management, procurement, and support functions.",
  },
  // Sibling companies — same Chavananand Family ownership as VCB, but NOT
  // part of VCB's own corporate structure.
  familyCompanies: [
    {
      id: "vpo",
      label: "Vichitbhan Palm Oil PCL (VPO)",
      sub: "Vichitbhan Palm Oil PCL is a Thailand-based company engaged in palm plantation and palm oil extraction. Its product line consists of crude palm oil, palm kernel, by-products such as shells, empty bunches, decanter cakes, and palm fiber products, and electricity which is produced from the treated waste water of the Palm Oil Crushing Mill.",
    },
    {
      id: "chavananand-holding",
      label: "Chavananand Holding Co., Ltd.",
      sub: "Operates and manages a commercial building, overseeing its day-to-day operations, maintenance, and tenant services. The company also manages the leasing of office spaces within the building, including tenant relations and rental administration.",
    },
  ],
  subsidiaries: [
    {
      id: "cve",
      label: "CVE",
      sub: "Manufactures pre-cast concrete components for Vichitbhan Group’s construction projects.",
    },
    {
      id: "cvn",
      label: "CVN Development",
      sub: "Develops property ventures on behalf of Vichitbhan Group, currently being established.",
    },
  ],
  jvs: [
    { id: "vk", label: "VK", parents: ["Vichitbhan Construction Co., Ltd.", "Kolatach"] },
    { id: "v-and-k", label: "V&K", parents: ["Vichitbhan Construction Co., Ltd.", "Kolatach"] },
    { id: "vn", label: "VN", parents: ["Vichitbhan Construction Co., Ltd.", "Napa Construction"] },
    { id: "vc", label: "VC", parents: ["Vichitbhan Construction Co., Ltd.", "CVN Development"] },
  ],
};
