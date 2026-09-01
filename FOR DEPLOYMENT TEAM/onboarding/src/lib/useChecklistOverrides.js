// The admin's checklist edits — a row per overridden item, layered onto the
// hardcoded department content in src/data/ rather than replacing it.
//
// ---------------------------------------------------------------------------
// THE SHARED ADMIN PASSWORD IS GONE.
// ---------------------------------------------------------------------------
// Writes used to go through admin_save_checklist_item / admin_delete_checklist_
// item — security-definer Postgres functions granted to `anon` that compared a
// caller-supplied string against a database setting and then wrote the table on
// the caller's behalf. 007_onboarding.sql DROPS those functions and they must
// not come back: one password shared by every admin, no identity attached, and
// a fallback literal ('__unset__') sitting in a file anyone could read.
//
// What replaces them: requireAuth + requireRole('portal','admin') on
// PUT/DELETE /api/onboarding/checklist. So these functions take NO password —
// the caller's JWT is the credential, and AuthProvider puts it on the request.
// A caller without the role gets a 403 from the API, which is the real gate;
// hiding the editor in the UI is only a courtesy.
// ---------------------------------------------------------------------------
//
// Reads stay anonymous: every employee's page load applies these.

import { useCallback, useEffect, useState } from 'react';
import {
  listChecklistOverrides,
  saveChecklistOverride,
  deleteChecklistOverride,
} from './onboardingApi.js';

/**
 * @typedef {object} ChecklistOverride
 * @property {string} itemId
 * @property {string} [pageKey]
 * @property {number} [blockIndex]
 * @property {string} [text]
 * @property {'junior'|'senior'} [level]
 * @property {boolean} deleted
 * @property {number} [order]
 */

/** Map one API row onto the shape the renderer uses. */
function toOverride(row) {
  return {
    itemId: row.item_id,
    pageKey: row.page_key ?? undefined,
    blockIndex: row.block_index ?? undefined,
    text: row.text ?? undefined,
    level: row.level ?? undefined,
    deleted: !!row.deleted,
    order: row.sort_order ?? undefined,
  };
}

export function useChecklistOverrides() {
  const [overrides, setOverrides] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const list = await listChecklistOverrides();
      const next = {};
      for (const row of list ?? []) next[row.item_id] = toOverride(row);
      setOverrides(next);
      setError(null);
    } catch {
      // Overrides are an overlay on content that is already in the bundle, so
      // a failure here degrades to the hardcoded baseline rather than an empty
      // page. `loaded` is still set: the checklist is genuinely renderable.
      setError('admin.overridesLoadFailed');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Save one item. Requires the portal admin role; throws ApiError on 403. */
  const saveItem = useCallback(
    async (itemId, fields) => {
      await saveChecklistOverride(itemId, fields);
      await reload();
    },
    [reload]
  );

  /** Soft-delete one item. Requires the portal admin role. */
  const deleteItem = useCallback(
    async (itemId) => {
      await deleteChecklistOverride(itemId);
      await reload();
    },
    [reload]
  );

  return { overrides, loaded, error, saveItem, deleteItem, reload };
}
