-- ============================================================================
-- VCB-MANGO ERP SOP Web App — PostgreSQL schema
-- ============================================================================
-- Source of truth today: a Google Doc (parsed by the Apps Script backend into
-- the shapes below) — see ORIGINAL CODE/apps-script/Code.js (parseDoc_, parseSolutionCell_)
-- and ORIGINAL CODE/apps-script/index.html (MODULES, MODULE_INFO, SOP_FLOWS).
--
-- This schema is a straight relational mapping of that content, for handing
-- the data off to a Postgres-backed rewrite. It does not imply any change to
-- the live Apps Script app.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- modules: the 11 functional areas cases/flows/reports are organized under.
-- ----------------------------------------------------------------------------
CREATE TABLE modules (
  code          text PRIMARY KEY,        -- e.g. 'PO', 'IC', 'AP'
  name_th_short text NOT NULL,           -- sidebar label, e.g. 'จัดซื้อ'
  name_en_short text NOT NULL,           -- e.g. 'Purchasing'
  name_th       text,                    -- full name, e.g. 'ระบบใบสั่งซื้อ (PO)'
  name_en       text,                    -- e.g. 'Purchase Order System'
  desc_th       text,
  desc_en       text,
  sort_order    integer NOT NULL
);

-- ----------------------------------------------------------------------------
-- sop_meta: single-row document metadata (title, purpose, notes, version).
-- ----------------------------------------------------------------------------
CREATE TABLE sop_meta (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),  -- enforces 1 row
  title       text NOT NULL,
  subtitle    text,
  manual      text,
  version     text,
  effective   text,      -- free-text Thai date, e.g. 'เมษายน 2569'
  scope       text,
  purpose     text,
  notes       text[] NOT NULL DEFAULT '{}',
  updated_at  timestamptz
);

-- ----------------------------------------------------------------------------
-- scenarios: the case studies (the app's core content).
-- `no` is the original row-order id from the Doc (stable primary key).
-- `display_no` (e.g. 'PO-3') is DERIVED — computed as a per-module running
-- count over `no` order — and is NOT stored as authoritative in the app; it's
-- recomputed on every read. Kept here as a materialized convenience column.
-- ----------------------------------------------------------------------------
CREATE TABLE scenarios (
  no            integer PRIMARY KEY,
  module        text NOT NULL REFERENCES modules(code),
  display_no    text,                     -- e.g. 'PO-3' (derived, see above)
  title_th      text NOT NULL,
  title_en      text,
  problem       text NOT NULL,            -- "when" — the ปัญหา/สถานการณ์ text
  ref           text,                     -- manual reference, e.g. 'ERP Manual 14.3.68 – บทที่ 4 (PO)'
  note          text,                     -- optional [!] callout
  date_added    text                      -- free-text Thai date, e.g. '1 เมษายน 2569'
);

-- Ordered solution steps (SOLUTION / SOP). Each line is one of three kinds,
-- matching the client's plain-keyboard authoring convention (stepsToStorage/
-- stepsFromStorage in index.html) and how Code.js's parseSolutionCell_ reads
-- the Doc back:
--   - 'numbered'  — a top-level step. The literal "N. " prefix is written into
--     the Doc text itself (see the one-time renumberAllSteps_ migration); the
--     client still renders the *position*, not the literal N, via CSS counters.
--   - 'sub'       — a sub-bullet ('» ' repeated `depth` times, depth 1 = tier 2,
--     depth 2 = tier 3, …). depth is 0 for 'numbered'/'caption' rows.
--   - 'caption'   — an unmarked line ('· ' in storage), no number, no bullet;
--     plain body text under the previous step.
CREATE TABLE scenario_steps (
  scenario_no   integer NOT NULL REFERENCES scenarios(no) ON DELETE CASCADE,
  step_order    integer NOT NULL,        -- 1-based position within the scenario
  kind          text NOT NULL DEFAULT 'numbered'
                  CHECK (kind IN ('numbered', 'sub', 'caption')),
  depth         integer NOT NULL DEFAULT 0,  -- sub-bullet nesting tier (0 unless kind='sub')
  text          text NOT NULL,
  PRIMARY KEY (scenario_no, step_order)
);

-- Extra modules a case is tagged into, beyond its primary module. The case
-- still numbers/colors from its primary module; this only affects which
-- module lists it also appears in.
CREATE TABLE scenario_extra_modules (
  scenario_no   integer NOT NULL REFERENCES scenarios(no) ON DELETE CASCADE,
  module        text NOT NULL REFERENCES modules(code),
  PRIMARY KEY (scenario_no, module)
);

-- ----------------------------------------------------------------------------
-- reports: "How to pull a report" reference table (module -> menu path).
-- `case_no` links back to the scenario that report is documented for.
-- Admin-writable via createReport() (Code.js) — appends a row to the Doc's
-- reports table, then refreshFromDoc_() re-syncs the cache, same
-- write-then-refresh pattern as createScenario.
-- ----------------------------------------------------------------------------
-- Reference files attached to a case (flow-diagram PDFs and the like).
-- Link-only by design: the app stores a URL, never the file itself — the
-- files live in Drive under their own sharing rules. Mirrors the
-- "ไฟล์แนบ: Label | URL" metadata lines in the Apps Script build.
CREATE TABLE scenario_attachments (
  scenario_no   integer NOT NULL REFERENCES scenarios(no) ON DELETE CASCADE,
  sort_order    integer NOT NULL,        -- 1-based display position in the rail
  label         text NOT NULL,           -- caption under the thumbnail
  url           text NOT NULL,
  PRIMARY KEY (scenario_no, sort_order)
);

CREATE TABLE reports (
  id            serial PRIMARY KEY,
  case_no       integer NOT NULL REFERENCES scenarios(no),
  scenario_text text NOT NULL,            -- short description, may repeat/paraphrase the case
  report_path   text NOT NULL             -- e.g. 'AP -> Report -> 5.1.2 (Cheque Register Report)'
);

-- ----------------------------------------------------------------------------
-- process flows: the "ผังกระบวนการ" swimlane diagrams (33 flows).
-- Nested lanes/nodes/edges are modeled as JSONB rather than fully normalized —
-- they're diagram layout data (rank/lane coordinates), not queryable business
-- facts, and the app only ever reads/writes them as whole documents.
-- ----------------------------------------------------------------------------
CREATE TABLE process_flows (
  id            text PRIMARY KEY,         -- e.g. 'BD-1.0'
  module        text NOT NULL REFERENCES modules(code),
  title_th      text NOT NULL,
  title_en      text,
  sort_order    integer NOT NULL,
  lanes         jsonb NOT NULL,           -- [{key, name, sub, module}, ...]
  nodes         jsonb NOT NULL,           -- [{id, lane, rank, type, label}, ...]
  edges         jsonb NOT NULL,           -- [{from, to, label?}, ...]
  narrative     text[] NOT NULL DEFAULT '{}'  -- numbered step-by-step description; a
                                               -- leading "» " marks a sub-point, same
                                               -- convention as scenario_steps.is_substep
);

-- ----------------------------------------------------------------------------
-- admins: email allow-list for write access (New/Edit/Swap/Delete case).
-- Everyone else gets read-only access; the whole app is otherwise public
-- (ANYONE_ANONYMOUS deployment — no login required to view).
-- ----------------------------------------------------------------------------
CREATE TABLE admins (
  email text PRIMARY KEY
);

CREATE INDEX idx_scenarios_module ON scenarios(module);
CREATE INDEX idx_scenario_extra_modules_module ON scenario_extra_modules(module);
CREATE INDEX idx_scenario_attachments_scenario ON scenario_attachments(scenario_no);
CREATE INDEX idx_reports_case_no ON reports(case_no);
CREATE INDEX idx_process_flows_module ON process_flows(module);

COMMIT;
