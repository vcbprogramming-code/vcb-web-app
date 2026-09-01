import type { ChecklistBlock, ChecklistItem } from "../data/types";
import type { ChecklistOverride } from "./useChecklistOverrides";

// Ported from the original app's applyChecklistOverrides (content.html) —
// layers admin edits onto the hardcoded baseline at render time: edits
// existing items in place by id, appends brand-new items (an override id
// with no hardcoded counterpart), removes soft-deleted ones, and re-sorts
// any block that received an explicit order. A block with no overridden
// items behaves identically to the hardcoded baseline.
export function applyOverridesToBlock(
  block: ChecklistBlock,
  overrides: Record<string, ChecklistOverride>,
  pageKey: string,
  blockIndex: number,
): ChecklistBlock {
  const edited: (ChecklistItem & { _order?: number })[] = block.items
    .filter((item) => !overrides[item.id]?.deleted)
    .map((item) => {
      const o = overrides[item.id];
      if (!o) return item;
      return {
        ...item,
        text: o.text ?? item.text,
        level: o.level ?? item.level,
        _order: o.order,
      };
    });

  // Brand-new items added purely through the admin editor — an override
  // row whose id has no hardcoded counterpart in this block.
  const newItems = Object.values(overrides)
    .filter(
      (o) =>
        !o.deleted &&
        o.pageKey === pageKey &&
        o.blockIndex === blockIndex &&
        !block.items.some((item) => item.id === o.itemId),
    )
    .map((o) => ({ id: o.itemId, text: o.text ?? "", level: o.level, _order: o.order }));

  const all = [...edited, ...newItems];
  const hasExplicitOrder = all.some((item) => item._order !== undefined);
  if (hasExplicitOrder) {
    all.sort((a, b) => (a._order ?? Number.MAX_SAFE_INTEGER) - (b._order ?? Number.MAX_SAFE_INTEGER));
  }

  return { ...block, items: all.map(({ _order, ...item }) => item) };
}
