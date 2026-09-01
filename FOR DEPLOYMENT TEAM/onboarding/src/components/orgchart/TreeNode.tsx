import { useState, type ReactNode } from "react";

// A single collapsible node in the org tree. Rebuilt with a proper
// React/CSS approach (nested flex/grid + border-based tree guides) rather
// than the original app's hand-measured getBoundingClientRect() connector
// lines — see React/README.md's "Org chart" section for why: that
// technique was explicitly the most fragile part of the original app
// (five-plus real rounds of bugs, per its own docs/KNOWN_ISSUES.md), and
// doesn't map cleanly onto React's render model anyway (it re-measures
// the DOM imperatively after every state change). CSS-drawn guides via
// ::before/::after borders on .tree-children reflow correctly for free
// on every React re-render, with no JS measurement step at all.
export function TreeNode({
  label,
  meta,
  children,
  defaultOpen = false,
}: {
  label: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div className="tree-node">
      <button
        type="button"
        className="tree-node-btn"
        onClick={() => hasChildren && setOpen((v) => !v)}
        aria-expanded={hasChildren ? open : undefined}
        disabled={!hasChildren}
      >
        <span className="tree-node-label">{label}</span>
        {meta && <span className="tree-node-meta">{meta}</span>}
      </button>
      {hasChildren && open && <div className="tree-children">{children}</div>}
    </div>
  );
}

export function TreeRow({ children }: { children: ReactNode }) {
  return <div className="tree-row">{children}</div>;
}

export function PersonCard({ person }: { person: { name: string; role?: string } }) {
  const [open, setOpen] = useState(false);
  const initials = person.name
    .replace(/^(Mr\.|Mrs\.|Ms\.)\s*/, "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="person-card">
      <button
        type="button"
        className="person-card-btn"
        onClick={() => person.role && setOpen((v) => !v)}
        aria-expanded={person.role ? open : undefined}
      >
        <span className="person-avatar">{initials}</span>
        <span className="person-name">{person.name}</span>
      </button>
      {open && person.role && <div className="person-role">{person.role}</div>}
    </div>
  );
}
