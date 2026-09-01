import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ALL_DEPARTMENTS } from "../data/allDepartments";
import { useChecklistOverrides } from "../lib/useChecklistOverrides";
import type { ChecklistBlock } from "../data/types";

// Ported from the original app's admin.html — password-gated checklist
// editor. The password is verified server-side on EVERY write, not just at
// this gate: checklist_overrides has no insert/update/delete policy, and
// writes go through the admin_save_checklist_item /
// admin_delete_checklist_item security-definer RPCs, which check the
// password inside the same call that performs the write (see
// supabase/schema.sql). That is why the password is threaded down to each
// row here rather than only unlocking the UI — the original app's exact
// bug was capturing the password at the prompt and never sending it.

const PHASES = [
  { suffix: "day-1-30" as const, label: "Phase 1 (Day 1–30)" },
  { suffix: "day-31-60" as const, label: "Phase 2 (Day 31–60)" },
  { suffix: "day-61-90" as const, label: "Phase 3 (Day 61–90)" },
];

export function AdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [deptId, setDeptId] = useState(ALL_DEPARTMENTS[0].id);
  const [phaseSuffix, setPhaseSuffix] = useState<(typeof PHASES)[number]["suffix"]>("day-1-30");
  const [blockIndex, setBlockIndex] = useState(0);

  const { overrides, saveItem, deleteItem } = useChecklistOverrides();

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("check_admin_password", {
      attempt: password,
    });
    setChecking(false);
    if (rpcError) {
      setError("Could not reach the server — try again.");
      return;
    }
    if (data) {
      setUnlocked(true);
    } else {
      setError("Incorrect password.");
    }
  }

  if (!unlocked) {
    return (
      <div className="page admin-gate">
        <h1>Admin — Checklist Editor</h1>
        <p>Enter the admin password to edit department checklists.</p>
        {error && <p className="locked-notice">{error}</p>}
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
          />
          <button type="submit" disabled={checking}>
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  const dept = ALL_DEPARTMENTS.find((d) => d.id === deptId)!;
  const phase = dept.content.phases.find((p) => p.dayRange === phaseSuffix)!;
  const block: ChecklistBlock | undefined = phase.page.blocks[blockIndex];
  const pageKey = `${dept.phasePrefix}-${phaseSuffix}`;

  return (
    <div className="page admin-shell">
      <h1>Checklist Editor</h1>

      <div className="admin-nav">
        <div className="admin-nav-row">
          {ALL_DEPARTMENTS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === deptId ? "active" : ""}
              onClick={() => setDeptId(d.id)}
            >
              {d.content.title}
            </button>
          ))}
        </div>
        <div className="admin-nav-row">
          {PHASES.map((p) => (
            <button
              key={p.suffix}
              type="button"
              className={p.suffix === phaseSuffix ? "active" : ""}
              onClick={() => setPhaseSuffix(p.suffix)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="admin-nav-row">
          {phase.page.blocks.map((b, i) => (
            <button
              key={b.heading}
              type="button"
              className={i === blockIndex ? "active" : ""}
              onClick={() => setBlockIndex(i)}
            >
              {b.heading}
            </button>
          ))}
        </div>
      </div>

      {block && (
        <ul className="admin-item-list">
          {block.items
            .filter((item) => !overrides[item.id]?.deleted)
            .map((item) => {
              const override = overrides[item.id];
              const effectiveText = override?.text ?? item.text;
              const effectiveLevel = override?.level ?? item.level ?? "junior";
              return (
                <AdminItemRow
                  key={item.id}
                  itemId={item.id}
                  text={effectiveText}
                  isSenior={effectiveLevel === "senior"}
                  pageKey={pageKey}
                  blockIndex={blockIndex}
                  password={password}
                  onSave={saveItem}
                  onDelete={deleteItem}
                />
              );
            })}
        </ul>
      )}
    </div>
  );
}

function AdminItemRow({
  itemId,
  text,
  isSenior,
  pageKey,
  blockIndex,
  password,
  onSave,
  onDelete,
}: {
  itemId: string;
  text: string;
  isSenior: boolean;
  pageKey: string;
  blockIndex: number;
  password: string;
  onSave: (
    password: string,
    itemId: string,
    fields: { pageKey?: string; blockIndex?: number; text?: string; level?: "junior" | "senior" },
  ) => Promise<void>;
  onDelete: (password: string, itemId: string) => Promise<void>;
}) {
  const [draftText, setDraftText] = useState(text);
  const [draftSenior, setDraftSenior] = useState(isSenior);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSave() {
    setStatus("Saving…");
    try {
      await onSave(password, itemId, {
        pageKey,
        blockIndex,
        text: draftText,
        level: draftSenior ? "senior" : "junior",
      });
      setStatus("Saved");
    } catch {
      setStatus("Save failed");
    }
    setTimeout(() => setStatus(null), 2500);
  }

  async function handleDelete() {
    if (!confirm("Delete this checklist item? This can be restored later by an admin re-adding it.")) return;
    await onDelete(password, itemId);
  }

  return (
    <li className="admin-item-row">
      <div className="admin-item-main">
        <textarea rows={2} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
        <label>
          <input type="checkbox" checked={draftSenior} onChange={(e) => setDraftSenior(e.target.checked)} />
          Senior-only
        </label>
      </div>
      <div className="admin-item-actions">
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={handleDelete}>
          Delete
        </button>
        {status && <span className="admin-item-status">{status}</span>}
      </div>
    </li>
  );
}
