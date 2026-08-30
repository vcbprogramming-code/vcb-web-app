import { useState } from "react";
import { DEPARTMENTS } from "../data/departments";

// Ported from the original app's promptForEmployeeName (progress.html) —
// name + department, shown the first time a checklist task is touched.
export function NameModal({
  onSubmit,
}: {
  onSubmit: (name: string, departmentId: string) => void;
}) {
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(DEPARTMENTS[0]?.id ?? "");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="name-modal-title">
      <div className="name-modal">
        <h2 id="name-modal-title">Welcome! What is your name?</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed || !departmentId) return;
            onSubmit(trimmed, departmentId);
          }}
        >
          {/* Visually-hidden labels: a placeholder is not an accessible
              name, so without these the inputs announce as unlabelled. */}
          <label className="sr-only" htmlFor="name-modal-input">
            Your full name
          </label>
          <input
            id="name-modal-input"
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <label className="sr-only" htmlFor="name-modal-dept">
            Select your department
          </label>
          <select
            id="name-modal-dept"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <button type="submit">Continue</button>
        </form>
      </div>
    </div>
  );
}
