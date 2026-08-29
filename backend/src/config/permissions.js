// =============================================================================
// Action-level permissions (backlog round 2 #3).
//
// A permission key is "<module>.<action>", e.g. "ememo.create". Each profile has
// a JSON override map on profiles.permissions:
//   { "ememo": { "create": true, "approve": false }, ... }
// A missing module or action falls back to the role's default below, so existing
// accounts keep working with no per-user config (backwards compatible).
//
// admin always has every permission (short-circuited in hasPermission).
// =============================================================================

/** The catalogue of modules and their guardable actions (drives the UI grid). */
export const PERMISSION_CATALOG = [
  {
    module: 'ememo',
    label: 'E-Memo (บันทึกข้อความ)',
    actions: [
      { key: 'view', label: 'ดูเอกสาร' },
      { key: 'create', label: 'สร้าง/แก้ไขเอกสาร' },
      { key: 'submit', label: 'ส่งอนุมัติ' },
      { key: 'settings', label: 'ตั้งค่าโมดูล (โครงการ/รหัส)' },
    ],
  },
  {
    // renamed with the Module 2 rework: this is the daily work-ACTIVITY log
    // (hr-worklog) — there is no OT in it any more.
    module: 'performance',
    label: 'บันทึกงานฝ่ายบุคคล',
    actions: [
      { key: 'view', label: 'ดูข้อมูล' },
      { key: 'edit', label: 'บันทึก/แก้ไขงานรายวัน' },
      // The acceptance criteria want the person who checks the numbers to be a
      // different person from the one who keys them, appointed without a code
      // change — so verification is its own switch, not a role.
      { key: 'verify', label: 'ตรวจสอบและยืนยันข้อมูล' },
    ],
  },
  {
    module: 'credit',
    label: 'วงเงินสินเชื่อ',
    actions: [
      { key: 'view', label: 'ดูข้อมูล' },
      { key: 'edit', label: 'บันทึก/แก้ไข' },
    ],
  },
  {
    module: 'onboarding',
    label: 'รับพนักงานใหม่',
    actions: [
      { key: 'view', label: 'ดูข้อมูล' },
      { key: 'edit', label: 'บันทึก/แก้ไข' },
    ],
  },
  {
    module: 'sop',
    label: 'คู่มือปฏิบัติงาน (SOP)',
    actions: [
      { key: 'view', label: 'ดูคู่มือ' },
      { key: 'edit', label: 'แก้ไขเนื้อหา' },
    ],
  },
  {
    module: 'meetings',
    label: 'รายงานการประชุม',
    actions: [
      { key: 'view', label: 'ดูรายงาน' },
      { key: 'edit', label: 'สร้าง/แก้ไขรายงาน' },
      { key: 'manage', label: 'จัดการกลุ่มการประชุม' },
    ],
  },
  {
    module: 'sysmap',
    label: 'แผนผังระบบ (System Map)',
    actions: [
      { key: 'view', label: 'ดูแผนผัง' },
      { key: 'edit', label: 'แก้ไขข้อมูลแผนผัง' },
    ],
  },
];

/**
 * Role defaults — used when a profile has no explicit override for a key.
 * Shape: { role: { module: { action: boolean } } }. Anything not listed = false
 * (except admin, which is allowed everything by hasPermission).
 */
const ROLE_DEFAULTS = {
  executive: {
    ememo: { view: true, create: true, submit: true, settings: false },
    performance: { view: true, edit: false, verify: true },
    credit: { view: true, edit: true },
    onboarding: { view: true, edit: false },
    sop: { view: true, edit: false },
    // The operating map is reference material the whole company reads; editing
    // it rewrites how the business says it works, so that stays with an admin.
    sysmap: { view: true, edit: false },
    meetings: { view: true, edit: false, manage: false },
  },
  // ผู้บันทึกข้อมูลหน้างาน — keys the day for the sites they are assigned, and
  // nothing else. No verification: §5 says the recorder cannot sign their own.
  recorder: {
    ememo: { view: false, create: false, submit: false, settings: false },
    performance: { view: true, edit: true, verify: false },
    credit: { view: false, edit: false },
    onboarding: { view: false, edit: false },
    sop: { view: true, edit: false },
    sysmap: { view: true, edit: false },
    meetings: { view: false, edit: false, manage: false },
  },
  // หัวหน้าโครงการ / วิศวกรผู้ตรวจสอบ — checks and signs off, does not key.
  verifier: {
    ememo: { view: true, create: false, submit: false, settings: false },
    performance: { view: true, edit: false, verify: true },
    credit: { view: false, edit: false },
    onboarding: { view: false, edit: false },
    sop: { view: true, edit: false },
    sysmap: { view: true, edit: false },
    meetings: { view: true, edit: false, manage: false },
  },
  hr: {
    ememo: { view: true, create: true, submit: true, settings: false },
    performance: { view: true, edit: true, verify: false },
    credit: { view: false, edit: false },
    onboarding: { view: true, edit: true },
    sop: { view: true, edit: false },
    sysmap: { view: true, edit: false },
    meetings: { view: true, edit: true, manage: false },
  },
};

/**
 * Resolve whether a profile may perform "<module>.<action>".
 * Precedence: admin → per-user override → role default → false.
 */
export function hasPermission(profile, module, action) {
  if (!profile) return false;
  if (profile.role === 'admin') return true;

  const overrides = profile.permissions || {};
  const o = overrides[module];
  if (o && typeof o[action] === 'boolean') return o[action];

  const def = ROLE_DEFAULTS[profile.role]?.[module]?.[action];
  return def === true;
}

/**
 * Given a role and a desired full permission map, return ONLY the entries that
 * differ from that role's defaults — the minimal override set. Storing this
 * (instead of the fully-resolved map the UI sends) is what keeps later role
 * changes working: any action the admin didn't actually change stays unset and
 * keeps falling through to the (possibly new) role default.
 */
export function overridesFromEffective(role, desired) {
  // Admins implicitly have every permission (hasPermission short-circuits them),
  // so their effective map is all-true. Without treating admin's default as true
  // here, saving that map would persist an all-true override for EVERY action —
  // which then survives a later demotion to a lower role and grants it everything.
  const out = {};
  for (const { module, actions } of PERMISSION_CATALOG) {
    for (const { key } of actions) {
      const want = desired?.[module]?.[key];
      if (typeof want !== 'boolean') continue;
      const def = role === 'admin' ? true : (ROLE_DEFAULTS[role]?.[module]?.[key] === true);
      if (want !== def) {
        if (!out[module]) out[module] = {};
        out[module][key] = want;
      }
    }
  }
  return out;
}

/**
 * Build the full effective permission map for a profile (every catalog key
 * resolved to a boolean) — used by the admin UI to show current state.
 */
export function effectivePermissions(profile) {
  const out = {};
  for (const { module, actions } of PERMISSION_CATALOG) {
    out[module] = {};
    for (const { key } of actions) {
      out[module][key] = hasPermission(profile, module, key);
    }
  }
  return out;
}
