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
    module: 'performance',
    label: 'ประเมินผล & OT',
    actions: [
      { key: 'view', label: 'ดูข้อมูล' },
      { key: 'edit', label: 'บันทึก/แก้ไข' },
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
];

/**
 * Role defaults — used when a profile has no explicit override for a key.
 * Shape: { role: { module: { action: boolean } } }. Anything not listed = false
 * (except admin, which is allowed everything by hasPermission).
 */
const ROLE_DEFAULTS = {
  executive: {
    ememo: { view: true, create: true, submit: true, settings: false },
    performance: { view: true, edit: false },
    credit: { view: true, edit: true },
    onboarding: { view: true, edit: false },
  },
  hr: {
    ememo: { view: true, create: true, submit: true, settings: false },
    performance: { view: true, edit: true },
    credit: { view: false, edit: false },
    onboarding: { view: true, edit: true },
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
  const out = {};
  for (const { module, actions } of PERMISSION_CATALOG) {
    for (const { key } of actions) {
      const want = desired?.[module]?.[key];
      if (typeof want !== 'boolean') continue;
      const def = ROLE_DEFAULTS[role]?.[module]?.[key] === true;
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
