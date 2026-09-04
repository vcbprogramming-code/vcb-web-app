// Whether every required document is marked done — ported from
// areRequiredDocsComplete()/getMissingRequiredDocTitles() in progress.html.
//
// Used to hard-gate Department Selection (app.html's dept-card click handler)
// and, doubled up as isPhasePageUnlocked did, a department's own first phase —
// so the lock chain genuinely starts at "finish pre-boarding docs" rather than
// only kicking in one step later.

import { REQUIRED_DOCUMENTS } from '../data/requiredDocuments.js';

export function areRequiredDocsComplete(isTaskDone) {
  return REQUIRED_DOCUMENTS.every((doc) => isTaskDone(`doc::${doc.id}`));
}

export function missingRequiredDocs(isTaskDone) {
  return REQUIRED_DOCUMENTS.filter((doc) => !isTaskDone(`doc::${doc.id}`));
}
