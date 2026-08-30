import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Ported from the original app's getChecklistOverrides/saveChecklistItem/
// deleteChecklistItem (Code.gs) — a row per overridden checklist item,
// layered onto the hardcoded department content (src/data/*.ts) rather
// than replacing it. See supabase/schema.sql's checklist_overrides table.

export interface ChecklistOverride {
  itemId: string;
  pageKey?: string;
  blockIndex?: number;
  text?: string;
  level?: "junior" | "senior";
  deleted: boolean;
  order?: number;
}

export function useChecklistOverrides() {
  const [overrides, setOverrides] = useState<Record<string, ChecklistOverride>>({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("checklist_overrides").select("*");
    if (error) {
      console.error("Failed to load checklist overrides:", error);
      setLoaded(true);
      return;
    }
    const next: Record<string, ChecklistOverride> = {};
    for (const row of data ?? []) {
      next[row.item_id] = {
        itemId: row.item_id,
        pageKey: row.page_key ?? undefined,
        blockIndex: row.block_index ?? undefined,
        text: row.text ?? undefined,
        level: row.level ?? undefined,
        deleted: row.deleted,
        order: row.sort_order ?? undefined,
      };
    }
    setOverrides(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /* Writes go through a security-definer RPC that verifies the admin
     password in the SAME call that performs the write — the table itself
     has no insert/update/delete policy, so a client cannot write it
     directly with the anon key. This replaced a plain
     .from('checklist_overrides').upsert(), which left the password gate
     living only in the UI: anyone could open devtools and rewrite any
     department's checklist without seeing the prompt. Mirrors the
     original app's requireAdmin_() (Code.gs). See supabase/schema.sql.

     The password therefore has to be passed in on every write — exactly
     the mistake the original app made was capturing it at the prompt and
     never sending it. */
  const saveItem = useCallback(
    async (
      password: string,
      itemId: string,
      fields: Partial<Omit<ChecklistOverride, "itemId">>,
    ) => {
      const { error } = await supabase.rpc("admin_save_checklist_item", {
        attempt: password,
        p_item_id: itemId,
        p_page_key: fields.pageKey ?? null,
        p_block_index: fields.blockIndex ?? null,
        p_text: fields.text ?? null,
        p_level: fields.level ?? null,
        p_deleted: fields.deleted ?? false,
        p_sort_order: fields.order ?? null,
      });
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const deleteItem = useCallback(
    async (password: string, itemId: string) => {
      const { error } = await supabase.rpc("admin_delete_checklist_item", {
        attempt: password,
        p_item_id: itemId,
      });
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  return { overrides, loaded, saveItem, deleteItem, reload };
}
