// Onboarding Portal.
//
// THIS IS THE WIDEST ACCESS SURFACE IN THE SYSTEM. Read this before adding or
// changing anything here.
//
// Every RLS policy in the original schema is "readable/insertable/updatable by
// anyone". That was not an oversight and it is not a policy that can simply be
// tightened: the people who use this module are new hires on their first day,
// BEFORE anyone has created an account for them. The Apps Script version had no
// sign-in at all, and identity is still a name typed into a box and kept in
// localStorage. Requiring a token here would lock out exactly the users the
// module exists for.
//
// So the guard is `allowAnonymous`, which reproduces that intent honestly: it
// reads a token when one is present but never rejects. What that buys us is
// nothing security-wise, and the compensating controls are these:
//
//   * Every write is SCOPED to a named employee row wherever a scope exists —
//     the employee name comes from the URL path or is resolved from an existing
//     row, never inferred, so a caller can only touch one person's record per
//     request rather than the whole table.
//   * checklist_overrides is the exception and stays gated: it is shared
//     content rendered into every employee's page, so an anonymous write there
//     would let anyone rewrite every department's checklist. The old schema had
//     no write policy on it and routed writes through a password-checking
//     security-definer function; here that is requireRole('portal','admin').
//   * Nothing sensitive lives in these tables. Names, a department, a level and
//     a set of ticked checkboxes.
//
// Do NOT put anything here that would be damaging to read or forge. If this
// module ever needs to hold something real, it needs real accounts first.
//
// Table names are schema-qualified to `onboarding`. NEVER write an unqualified
// `employees` — `hr.employees` is a different table keyed by eid, and the two
// are trivially confused.

import { Router } from 'express';
import { z } from 'zod';
import { rows, one, tx } from '../db.js';
import { allowAnonymous, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { presignUpload, presignDownload } from '../lib/storage.js';

const router = Router();

/* --------------------------------- schemas -------------------------------- */

// The name IS the primary key, so it is trimmed everywhere before it touches
// the database. An untrimmed variant creates a second, empty record that looks
// to the employee exactly like their progress having been lost.
const employeeName = z
  .string()
  .trim()
  .min(1, 'name is required')
  .max(200);

const level = z.enum(['junior', 'senior']);

const identifySchema = z.object({
  name: employeeName,
  department: z.string().trim().max(120).optional(),
  level: level.optional(),
});

const toggleSchema = z.object({
  task_id: z.string().min(1).max(120),
  completed: z.boolean(),
});

/* -------------------------------- employees ------------------------------- */

/**
 * Register or update the employee doing the onboarding.
 *
 * Upsert, not insert: a returning employee re-typing their name must land back
 * on their own record instead of being rejected or reset to defaults. Only the
 * fields actually supplied are overwritten, so setting a level does not blank a
 * department set earlier.
 */
router.post(
  '/employees',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const body = identifySchema.parse(req.body);
    const row = await one(
      `insert into onboarding.employees (name, department, level)
       values ($1, $2, coalesce($3, 'junior'))
       on conflict (name) do update set
         department = coalesce(excluded.department, onboarding.employees.department),
         level      = coalesce($3, onboarding.employees.level),
         updated_at = now()
       returning name, department, level, created_at, updated_at`,
      [body.name, body.department ?? null, body.level ?? null]
    );
    res.json(row);
  })
);

router.get(
  '/employees/:name',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const row = await one(
      'select name, department, level, created_at, updated_at from onboarding.employees where name = $1',
      [name]
    );
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(row);
  })
);

// Scoped by the name in the path — this can only ever touch one record.
router.patch(
  '/employees/:name',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const body = z
      .object({ department: z.string().trim().max(120).optional(), level: level.optional() })
      .parse(req.body);

    const row = await one(
      `update onboarding.employees
          set department = coalesce($2, department),
              level      = coalesce($3, level),
              updated_at = now()
        where name = $1
        returning name, department, level, created_at, updated_at`,
      [name, body.department ?? null, body.level ?? null]
    );
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(row);
  })
);

/**
 * Correct a typo'd name.
 *
 * A mistyped name silently starts a fresh, empty record — the server cannot
 * tell a typo from a genuinely new hire — so this MUST carry the existing
 * progress across rather than just renaming. If rows already exist under the
 * target name (the employee is merging a typo back onto their real record) the
 * two are UNIONED: a task completed under either spelling stays completed.
 *
 * One transaction, and the old rows are removed only after the merged rows are
 * written, so a failure anywhere leaves the original record intact.
 */
router.post(
  '/employees/:name/rename',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const from = employeeName.parse(req.params.name);
    const { to } = z.object({ to: employeeName }).parse(req.body);
    if (from === to) return res.status(400).json({ error: 'SAME_NAME' });

    const result = await tx(async (c) => {
      const src = await c.query(
        'select name, department, level from onboarding.employees where name = $1',
        [from]
      );
      if (!src.rows[0]) {
        const e = new Error('Employee not found');
        e.status = 404;
        e.code = 'NOT_FOUND';
        throw e;
      }

      await c.query(
        `insert into onboarding.employees (name, department, level)
         values ($1, $2, $3)
         on conflict (name) do update set
           department = coalesce(onboarding.employees.department, excluded.department),
           level      = coalesce(onboarding.employees.level, excluded.level),
           updated_at = now()`,
        [to, src.rows[0].department, src.rows[0].level]
      );

      // Union in SQL: `completed = true or excluded.completed` means a task done
      // under either spelling survives, and nothing already ticked under the
      // target name is un-ticked.
      const moved = await c.query(
        `insert into onboarding.progress (employee_name, task_id, completed, updated_at)
         select $2, task_id, completed, now()
           from onboarding.progress
          where employee_name = $1
         on conflict (employee_name, task_id) do update set
           completed = onboarding.progress.completed or excluded.completed,
           updated_at = now()`,
        [from, to]
      );

      await c.query('delete from onboarding.progress where employee_name = $1', [from]);
      await c.query('delete from onboarding.employees where name = $1', [from]);
      return moved.rowCount;
    });

    res.json({ ok: true, name: to, moved: result });
  })
);

/**
 * Switch department, discarding the old department's progress.
 *
 * The task ids to clear are sent by the client because they come from that
 * department's own content file, which the API does not have. The original app
 * derived them from a page-key prefix instead and silently deleted nothing —
 * the ids use a different abbreviated scheme, so the old checkmarks reappeared
 * on the next load. Do not reintroduce prefix matching here.
 */
router.post(
  '/employees/:name/department',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const body = z
      .object({
        department: z.string().trim().min(1).max(120),
        clear_task_ids: z.array(z.string().min(1).max(120)).max(1000).default([]),
      })
      .parse(req.body);

    const row = await tx(async (c) => {
      if (body.clear_task_ids.length) {
        await c.query(
          'delete from onboarding.progress where employee_name = $1 and task_id = any($2::text[])',
          [name, body.clear_task_ids]
        );
      }
      const up = await c.query(
        `insert into onboarding.employees (name, department)
         values ($1, $2)
         on conflict (name) do update set department = excluded.department, updated_at = now()
         returning name, department, level`,
        [name, body.department]
      );
      return up.rows[0];
    });

    res.json({ ok: true, employee: row, cleared: body.clear_task_ids.length });
  })
);

/* --------------------------------- progress ------------------------------- */

/**
 * One employee's completed tasks.
 *
 * Returns 404 for an unknown name rather than an empty list on purpose: the
 * client renders "no progress" and "could not load" very differently, and an
 * empty array for a name that does not exist is indistinguishable from a
 * transient failure — which is how the original app got employees re-ticking
 * boxes on top of saved state they could not see.
 */
router.get(
  '/progress/:name',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const emp = await one('select name from onboarding.employees where name = $1', [name]);
    if (!emp) return res.status(404).json({ error: 'NOT_FOUND' });

    const list = await rows(
      `select task_id, completed, updated_at
         from onboarding.progress
        where employee_name = $1
        order by task_id`,
      [name]
    );
    res.json({ name, rows: list });
  })
);

// Ticking a box. Scoped to the employee in the path, and the foreign key means
// an unknown name is rejected (23503 → 409) rather than creating an orphan
// progress row nothing will ever read.
router.put(
  '/progress/:name',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const body = toggleSchema.parse(req.body);

    const row = await one(
      `insert into onboarding.progress (employee_name, task_id, completed, updated_at)
       values ($1, $2, $3, now())
       on conflict (employee_name, task_id) do update set
         completed = excluded.completed, updated_at = now()
       returning task_id, completed, updated_at`,
      [name, body.task_id, body.completed]
    );
    res.json(row);
  })
);

// Batch form of the above, for the client that saves a whole page at once. One
// transaction so a partial write cannot leave the checklist half-saved.
router.post(
  '/progress/:name/batch',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const body = z.object({ tasks: z.array(toggleSchema).min(1).max(500) }).parse(req.body);

    await tx(async (c) => {
      for (const t of body.tasks) {
        await c.query(
          `insert into onboarding.progress (employee_name, task_id, completed, updated_at)
           values ($1, $2, $3, now())
           on conflict (employee_name, task_id) do update set
             completed = excluded.completed, updated_at = now()`,
          [name, t.task_id, t.completed]
        );
      }
    });

    res.json({ ok: true, written: body.tasks.length });
  })
);

/* --------------------------- checklist overrides -------------------------- */

/**
 * The department checklist overrides.
 *
 * READS are open, because every employee's page load applies them — that
 * matches the old "readable by anyone" policy exactly.
 *
 * Deleted rows are included: the client layers them over its hardcoded content
 * and needs to know which items to REMOVE. Filtering them here would make a
 * deletion look like an item that was never overridden.
 */
router.get(
  '/checklist',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const q = z.object({ page_key: z.string().max(120).optional() }).parse(req.query);
    const list = await rows(
      `select item_id, page_key, block_index, text, level, deleted, sort_order, updated_at
         from onboarding.checklist_overrides
        where ($1::text is null or page_key = $1)
        order by page_key, sort_order nulls last, item_id`,
      [q.page_key ?? null]
    );
    res.json(list);
  })
);

const overrideSchema = z.object({
  item_id: z.string().min(1).max(120),
  page_key: z.string().max(120).nullable().optional(),
  block_index: z.number().int().nullable().optional(),
  text: z.string().max(5000).nullable().optional(),
  level: level.nullable().optional(),
  deleted: z.boolean().optional(),
  sort_order: z.number().int().nullable().optional(),
});

/**
 * WRITES are the one thing in this module that is NOT anonymous.
 *
 * This content is rendered into every employee's page, so an anonymous write
 * would let anyone rewrite or delete any department's checklist. The old schema
 * deliberately defined no insert/update/delete policy and routed writes through
 * admin_save_checklist_item(), a security-definer function that checked a
 * shared password inside the same call as the write. A shared password in a
 * Postgres setting is not an improvement on a real account, so here it becomes
 * the portal admin role: same gate, actual identity, and the audit trail of who
 * did it is at least possible.
 *
 * coalesce on each column reproduces the function's partial-edit behaviour: an
 * edit that omits a field must not blank it.
 */
router.put(
  '/checklist',
  requireAuth,
  requireRole('portal', 'admin'),
  asyncRoute(async (req, res) => {
    const o = overrideSchema.parse(req.body);
    const row = await one(
      `insert into onboarding.checklist_overrides
         (item_id, page_key, block_index, text, level, deleted, sort_order, updated_at)
       values ($1, $2, $3, $4, $5, coalesce($6, false), $7, now())
       on conflict (item_id) do update set
         page_key    = coalesce(excluded.page_key,    onboarding.checklist_overrides.page_key),
         block_index = coalesce(excluded.block_index, onboarding.checklist_overrides.block_index),
         text        = coalesce(excluded.text,        onboarding.checklist_overrides.text),
         level       = coalesce(excluded.level,       onboarding.checklist_overrides.level),
         deleted     = excluded.deleted,
         sort_order  = coalesce(excluded.sort_order,  onboarding.checklist_overrides.sort_order),
         updated_at  = now()
       returning *`,
      [
        o.item_id,
        o.page_key ?? null,
        o.block_index ?? null,
        o.text ?? null,
        o.level ?? null,
        o.deleted ?? false,
        o.sort_order ?? null,
      ]
    );
    res.json(row);
  })
);

// Soft delete: the row survives with deleted = true rather than being removed,
// because the client needs the row in order to know to hide the hardcoded item
// it overlays. A hard delete would make the item reappear.
//
// Note this is not an audit trail — rows are upserted in place, so an edit
// overwrites the previous text with no history and no actor column.
router.delete(
  '/checklist/:itemId',
  requireAuth,
  requireRole('portal', 'admin'),
  asyncRoute(async (req, res) => {
    const itemId = z.string().min(1).max(120).parse(req.params.itemId);
    const row = await one(
      `insert into onboarding.checklist_overrides (item_id, deleted, updated_at)
       values ($1, true, now())
       on conflict (item_id) do update set deleted = true, updated_at = now()
       returning item_id, deleted`,
      [itemId]
    );
    res.json({ ok: true, ...row });
  })
);

/* -------------------------------- documents ------------------------------- */

// The old schema's storage policies on the "required-documents" bucket are
// equally wide: "anyone can upload their own required documents" and "anyone
// can read required documents", both keyed on nothing but bucket_id. The
// upload itself does not go through these routes — it goes through the shared
// storage lib, which signs the URL — so the only thing this endpoint does is
// tell the client which object path a document belongs at.
//
// The path is keyed by employee name + docId + extension and NOT by the
// uploaded filename: with the filename in the path, uploading a
// differently-named file for the same requirement created a SECOND object
// instead of replacing the first, and nobody could tell which was current.
const ALLOWED_DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
export const DOCUMENTS_BUCKET = 'required-documents';

// Signed into the upload URL, so the extension the client asked for is the
// content type the object is stored as.
const DOC_CONTENT_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

router.get(
  '/documents/:name/path',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const name = employeeName.parse(req.params.name);
    const q = z
      .object({
        doc_id: z.string().min(1).max(120),
        ext: z.enum(ALLOWED_DOC_EXTENSIONS),
      })
      .parse(req.query);

    const emp = await one('select name from onboarding.employees where name = $1', [name]);
    if (!emp) return res.status(404).json({ error: 'NOT_FOUND' });

    const path = `${name}/${q.doc_id}.${q.ext}`;

    // Sign both directions here. The file itself never passes through Express:
    // the browser PUTs to uploadUrl and GETs from downloadUrl, so a large scan
    // does not occupy a worker for the length of the transfer, and does not hit
    // the 2 MB JSON body limit set in index.js.
    //
    // Content-Type is signed into the upload URL, so the holder cannot use it to
    // store something other than what they declared. The URLs expire in minutes,
    // which is what keeps an anonymous endpoint from becoming open storage —
    // the path is already scoped to one employee's folder.
    const contentType = DOC_CONTENT_TYPES[q.ext];
    let uploadUrl = null;
    let downloadUrl = null;
    try {
      [uploadUrl, downloadUrl] = await Promise.all([
        presignUpload(DOCUMENTS_BUCKET, path, contentType),
        presignDownload(DOCUMENTS_BUCKET, path),
      ]);
    } catch (err) {
      // Storage misconfigured (missing S3 credentials, wrong endpoint). Return
      // the path anyway so the client can say "hand this to HR" rather than
      // failing outright — a new employee should not be blocked by our config.
      console.error('[onboarding] could not sign document URLs:', err.message);
    }

    res.json({ bucket: DOCUMENTS_BUCKET, path, uploadUrl, downloadUrl });
  })
);

/* ---------------------------------- admin --------------------------------- */

// Who is onboarding, and how far along. Not anonymous: it is the whole cohort
// in one response, which is a different thing from an employee reading their
// own record.
router.get(
  '/admin/employees',
  requireAuth,
  requireRole('portal', 'admin'),
  asyncRoute(async (_req, res) => {
    const list = await rows(
      `select e.name, e.department, e.level, e.created_at, e.updated_at,
              (select count(*) from onboarding.progress p
                where p.employee_name = e.name and p.completed)::int as tasks_done
         from onboarding.employees e
        order by e.created_at desc`
    );
    res.json(list);
  })
);

export default router;
