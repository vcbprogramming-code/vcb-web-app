/**
 * Shared data shapes for the SOP React port.
 *
 * `Meta` / `Scenario` / `Report` / `SopData` mirror the JSON contract from the
 * canonical app (root index.html + apps-script/Code.gs + src/types.ts) — the
 * shape injected as `BOOTSTRAP` and returned by GET /api/data.
 *
 * `Flow` and friends describe the Process-Flow swimlane diagrams that are
 * bundled inline in index.html as `SOP_FLOWS` (not parsed from the Doc).
 */

/** Document-level metadata shown in the header / settings / welcome panes. */
export interface Meta {
  title: string;
  subtitle: string;
  manual: string;
  version: string;
  effective: string;
  scope: string;
  purpose: string;
  notes: string[];
  /** ISO timestamp of the last write to the store. */
  updatedAt?: string;
  /** Injected per-request, not persisted. True when the caller is an admin. */
  isAdmin?: boolean;
  /** Injected per-request, not persisted. The signed-in admin's email, if any. */
  userEmail?: string;
}

/** A single "what do I do when…" scenario card. */
export interface Scenario {
  no: number;
  /** ERP module code: SE, BD, OF, PO, IC, AP, AR, PM, FA, GL. */
  module: string;
  titleTH: string;
  titleEN: string;
  /** The triggering situation ("when this happens…"). */
  when: string;
  /** Ordered steps. A leading "» " marks a sub-step. */
  steps: string[];
  /** Reference into the manual, e.g. "บทที่ 2 …". */
  ref: string;
  /** Optional caveat shown in red. */
  note: string;
}

/** A row in the "which report do I run" table. */
export interface Report {
  case: number;
  scenario: string;
  /** Navigation path, e.g. "Sales > Reports > …". */
  path: string;
}

/** The full payload persisted in sop.json and sent to the client. */
export interface SopData {
  meta: Meta;
  scenarios: Scenario[];
  reports: Report[];
}

/** Payload accepted by editScenario() / POST /api/scenario. */
export interface ScenarioEdit {
  no: number;
  titleTH?: string;
  titleEN?: string;
  when?: string;
  steps?: string[];
  note?: string;
  ref?: string;
}

/* ----- Process Flow (swimlane diagram) shapes ----- */

/** A column in a swimlane diagram: a responsible actor + the ERP module used. */
export interface FlowLane {
  key: string;
  name: string;
  sub?: string;
  module?: string;
}

/** A box in the diagram, placed at {lane, rank} on the CSS grid. */
export interface FlowNode {
  id: string;
  lane: string;
  /** Vertical order (0 at top); nodes may share a rank across lanes. */
  rank: number;
  type?: 'start' | 'end' | 'process' | 'decision';
  label: string;
}

/** An arrow between two nodes. */
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  /** normal (default) · approve (blue) · yes (green) · reject (amber, loops). */
  kind?: 'normal' | 'approve' | 'yes' | 'reject';
}

/** One process-flow swimlane diagram. */
export interface Flow {
  id: string;
  module: string;
  titleTH: string;
  titleEN: string;
  lanes: FlowLane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Left-hand "กระบวนการ" text. '» ' = sub-bullet, '! ' = red note. */
  narrative?: string[];
}
