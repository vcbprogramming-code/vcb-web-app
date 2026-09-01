// The content data model, ported from the original app's content.html.
//
// TECH_STACK.md rules out TypeScript, so the interfaces that used to live here
// are JSDoc typedefs instead: they document the same shapes and still drive
// editor autocomplete, but nothing compiles them and nothing can fail at build
// time because of them.
//
// A checklist item's `id` is permanent — never reuse or reassign one once
// employees may have completed it. Progress rows in onboarding.progress are
// keyed by that id, so changing it silently detaches someone's saved progress
// from the task it belongs to. Renaming the TEXT is always safe; the id is a
// separate field precisely so that it is.

/** @typedef {'junior'|'senior'} EmployeeLevel */

/**
 * @typedef {object} ChecklistItem
 * @property {string} id            Permanent. See the note above.
 * @property {string} text
 * @property {EmployeeLevel} [level] Omitted = visible to everyone.
 */

/**
 * @typedef {object} ChecklistBlock
 * @property {string} heading
 * @property {ChecklistItem[]} items
 * @property {string} [sub]
 */

/**
 * @typedef {object} Department
 * @property {string} id
 * @property {string} label
 * @property {string} shortLabel
 * @property {string} prefix       Page-key namespace, e.g. "accounting-".
 * @property {string} landingPage
 * @property {string} headOfDept
 */

/**
 * @typedef {object} PhasePageContent
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} [subtitle]
 * @property {ChecklistBlock[]} blocks
 * @property {string} [nextPhasePage] Page key of the next phase; absent on the last.
 * @property {string} [closing]       Only set on the last phase (Day 61-90).
 */

/**
 * @typedef {object} DepartmentContent
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} supervisor
 * @property {string[]} overview
 * @property {string[]} bullets
 * @property {string} footerQuote
 * @property {string[]} workflow
 * @property {{ dayRange: 'day-1-30'|'day-31-60'|'day-61-90', page: PhasePageContent }[]} phases
 */

/**
 * @typedef {object} RequiredDocument
 * @property {string} id
 * @property {string} title
 * @property {string} action
 * @property {string} desc
 * @property {string} [viewUrl]
 * @property {string} [downloadUrl]
 */

// A module with only typedefs still needs a value export, or bundlers treat the
// import as side-effect-only and some tooling warns on the empty module.
export const LEVELS = ['junior', 'senior'];
