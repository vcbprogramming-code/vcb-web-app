// Meeting Minutes.
//
// THE THREE-TIER ACCESS MODEL. Reproduced from the RLS policies in
// meeting-minutes/FOR DEPLOYMENT TEAM/supabase/schema.sql, which no longer run:
// the browser used to talk to Supabase directly, so `auth.jwt() ->> 'email'`
// identified the caller. Now this API connects as one database user and every
// request looks identical to Postgres, so can_read_project() / is_editor() /
// is_admin() are dead code in the database and live here instead.
//
//   public  — readable by anyone, no sign-in at all (the app's 🔓)
//   locked  — admins, editors, and the emails on minutes.project_guests (🔒)
//   guest   — a locked project's named viewer: read-only, that project only
//
// The old app was deployed ANYONE_ANONYMOUS, so a visitor with no session is a
// normal and expected caller. Read routes therefore use allowAnonymous and
// filter by tier rather than requireAuth — a 401 here would be a regression.
//
// GOOGLE DOCS IMPORT IS PERMANENTLY DISABLED. `projects.doc_id`,
// `minutes.tab_id` and `source = 'doc-import'` are historical provenance for
// rows that came from Docs before 2026-07-19, when Docs stopped being the
// source of truth. Every meeting since is authored in the app. There is
// deliberately NO import endpoint below and there must not be one: re-importing
// would overwrite real in-app edits with stale Doc content. The columns are
// read and preserved, never written with a new 'doc-import' value.

import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { one, rows, tx } from '../db.js';
import { allowAnonymous, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { presignUpload, presignDownload, safeKey } from '../lib/storage.js';
import { randomToken } from '../auth.js';

const router = Router();

/* --------------------------------- helpers -------------------------------- */

const isAdmin = (req) => req.user?.roles?.minutes === 'admin';
const isEditor = (req) => {
  const r = req.user?.roles?.minutes;
  return r === 'admin' || r === 'editor';
};
const emailOf = (req) => (req.user?.email || '').toLowerCase();

/**
 * The project ids this caller may READ, as a SQL-ready array.
 *
 * Direct port of can_read_project(): every public project, plus — for a
 * signed-in caller — every project they are named on as a guest. Editors and
 * admins are handled by their callers short-circuiting instead, since "all
 * projects" is cheaper expressed as a boolean than as a list.
 */
async function readableProjectIds(req) {
  const email = emailOf(req);
  const list = await rows(
    `select p.id
       from minutes.projects p
      where p.visibility = 'public'
         or ($1 <> '' and exists (
              select 1 from minutes.project_guests g
               where g.project_id = p.id and lower(g.email) = $1))`,
    [email]
  );
  return list.map((r) => r.id);
}

/**
 * Can this caller read one specific project?
 *
 * Kept separate from readableProjectIds so a single-project check is one
 * indexed lookup rather than a full scan of the project table.
 */
async function canReadProject(req, projectId) {
  if (isEditor(req)) return true;
  const hit = await one(
    `select 1
       from minutes.projects p
      where p.id = $1
        and (p.visibility = 'public'
             or ($2 <> '' and exists (
                  select 1 from minutes.project_guests g
                   where g.project_id = p.id and lower(g.email) = $2)))`,
    [projectId, emailOf(req)]
  );
  return !!hit;
}

/** Append-only audit row. Every content-changing mutation writes one. */
function audit(client, actor, action, target, targetId, changes = null, note = null) {
  return client.query(
    `insert into minutes.audit_log (actor, action, target, target_id, changes, note)
     values ($1, $2, $3, $4, $5, $6)`,
    [actor, action, target, targetId, changes ? JSON.stringify(changes) : null, note]
  );
}

/** camelCase the list shape the React app expects (types.ts MeetingListItem). */
function toListItem(r, projectId, taggedFromInbox) {
  return {
    id: r.id,
    projectId,
    title: r.title || '',
    kind: r.kind || 'meeting',
    // The UI compares dates as strings and expects '' rather than null.
    date: r.meeting_date ? new Date(r.meeting_date).toISOString().slice(0, 10) : '',
    dateLabel: r.date_label || '',
    time: r.time || '',
    pinned: !!r.pinned,
    visible: !!r.visible,
    hasFathom: !!r.fathom_url,
    source: r.source || 'manual',
    attendeeCount: (r.attendees || []).length,
    attendees: r.attendees || [],
    excerpt: r.excerpt || '',
    attachmentCount: (r.attachments || []).length,
    ...(taggedFromInbox ? { taggedFromInbox: true } : {}),
  };
}

/**
 * One row can appear several times in the list: an inbox recording stays under
 * its own project_id forever AND shows up under each project it is tagged into.
 * Same id in each place; taggedFromInbox marks the copies. Mirrors listMeetings.
 */
function expandListRow(r, visibleTo) {
  const out = [toListItem(r, r.project_id)];
  for (const pid of r.tagged_project_ids || []) {
    // Skip a tag pointing at the row own project. The client keys the list by
    // projectId:id, so emitting both copies collides - React drops one and
    // warns about duplicate keys. Nothing stops a meeting being tagged into
    // the project it already belongs to, so filter it here rather than trust
    // the data.
    if (pid === r.project_id) continue;
    if (!visibleTo || visibleTo(pid)) out.push(toListItem(r, pid, true));
  }
  return out;
}

/* --------------------------------- schemas -------------------------------- */

const projectIdSchema = z.string().min(1).max(64);

const saveMeetingSchema = z.object({
  id: z.string().min(1).optional(),
  projectId: projectIdSchema,
  title: z.string().max(500),
  dateLabel: z.string().max(200).default(''),
  time: z.string().max(100).default(''),
  html: z.string().default(''),
  fathomUrl: z.string().max(2000).default(''),
  // 'doc-import' is absent on purpose. It is a historical value only; accepting
  // it here would let a client mint rows claiming a provenance that no longer
  // has a source, and the import path is never coming back.
  source: z.enum(['manual', 'fathom', 'transkriptor']).default('manual'),
  visible: z.boolean().optional(),
});

const saveEditSchema = z.object({
  html: z.string(),
  meta: z
    .object({
      title: z.string().max(500).optional(),
      dateLabel: z.string().max(200).optional(),
      time: z.string().max(100).optional(),
    })
    .optional(),
});

const visibilitySchema = z.object({ visible: z.boolean() });
const tagSchema = z.object({ projectId: projectIdSchema });
const searchSchema = z.object({ q: z.string().trim().min(1).max(200) });

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).default(''),
  cadence: z.string().trim().max(100).default('Monthly'),
});

const renameProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    nameEn: z.string().trim().max(200).optional(),
    cadence: z.string().trim().min(1).max(100).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'No fields to update' });

const guestSchema = z.object({ email: z.string().email() });
// A pasted list, split on whitespace/commas/semicolons. The whole batch is
// rejected on a bad entry so a typo is reported rather than half-saved.
const guestsSchema = z.object({ emails: z.string().min(1).max(20_000) });
const projectVisibilitySchema = z.object({ isPublic: z.boolean() });
const commentSchema = z.object({ text: z.string().trim().min(1).max(4000) });

// Mirrors ATTACHMENT_ALLOWED_MIME / ATTACHMENT_MAX_BYTES in the original Code.js.
const ATTACHMENT_ALLOWED_MIME =
  /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-(excel|powerpoint)|application\/msword|image\/(png|jpe?g|gif|webp)|text\/(plain|csv))/i;
const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(300),
  mimeType: z.string().max(200).refine((m) => ATTACHMENT_ALLOWED_MIME.test(m), {
    message: 'File type not allowed. Supported: PDF, Word, Excel, PowerPoint, images, text/CSV.',
  }),
  url: z.string().url().max(2000),
  size: z.number().int().nonnegative().max(ATTACHMENT_MAX_BYTES),
});

/* -------------------------- derived row fields ---------------------------- */
//
// The sheet computed excerpt/attendees/ISO date from the body on every save, so
// the list view never had to parse HTML. Kept server-side for the same reason:
// a client that skipped it would silently produce rows the list renders empty.

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAttendees(html) {
  const out = [];
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m;
  while ((m = re.exec(String(html || '')))) if (!out.includes(m[0])) out.push(m[0]);
  return out;
}

const pad2 = (n) => (n < 10 ? '0' : '') + n;

/** Port of parseDateLabel_: dd/mm/yyyy or "dd <Thai month> yyyy", BE or CE. */
function parseDateLabel(label) {
  const s = String(label || '').trim();
  let m = s.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/);
  if (m) {
    const d = +m[1];
    const mo = +m[2];
    let y = +m[3];
    if (y > 2400) y -= 543; // Buddhist era
    if (d && mo >= 1 && mo <= 12) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  const THM = ['มกรา', 'กุมภา', 'มีนา', 'เมษา', 'พฤษภา', 'มิถุนา', 'กรกฎา', 'สิงหา', 'กันยา', 'ตุลา', 'พฤศจิกา', 'ธันวา'];
  m = s.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (m) {
    const d = +m[1];
    let y = +m[3];
    if (y > 2400) y -= 543;
    const idx = THM.findIndex((t) => m[2].startsWith(t));
    if (idx >= 0 && d) return `${y}-${pad2(idx + 1)}-${pad2(d)}`;
  }
  return null;
}

/* -------------------------------- projects -------------------------------- */

/**
 * The project list. Public by policy ("projects readable by anyone") — the
 * sidebar renders for an anonymous visitor, so this cannot require auth.
 *
 * `count` is the number of meetings that caller may actually see, which is why
 * it is computed here rather than read from a column.
 */
router.get(
  '/projects',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const editor = isEditor(req);
    const admin = isAdmin(req);
    const email = emailOf(req);

    const list = await rows(
      `select p.id, p.name, p.name_en, p.cadence, p.color, p.sort_order,
              p.builtin, p.visibility, p.doc_id
         from minutes.projects p
        order by p.sort_order nulls last, p.id`
    );

    // Count against the same visibility rule the meeting list applies, so the
    // badge never promises rows the project tab then refuses to show.
    const counts = await rows(
      `select pid, count(*)::int as n
         from (
           -- distinct: a row tagged into its own project would otherwise
           -- count twice here and the badge would overstate the tab.
           select distinct m.id, unnest(array[m.project_id] || m.tagged_project_ids) as pid
             from minutes.minutes m
            where $1::boolean
               or (m.visible and (
                     exists (select 1 from minutes.projects p2
                              where p2.id = m.project_id and p2.visibility = 'public')
                  or ($2 <> '' and exists (select 1 from minutes.project_guests g
                              where g.project_id = m.project_id and lower(g.email) = $2))))
         ) t
        group by pid`,
      [editor, email]
    );
    const byId = new Map(counts.map((c) => [c.pid, c.n]));

    // Locked projects stay off an anonymous visitor's sidebar entirely —
    // showing the name of a project they cannot open is the leak the 🔒 tier
    // exists to prevent.
    const visible = list.filter((p) => editor || p.visibility === 'public');

    // A guest sees their locked projects too. Resolved separately because it
    // needs the guest table, not just the row.
    if (!editor && email) {
      const mine = await rows(
        `select project_id from minutes.project_guests where lower(email) = $1`,
        [email]
      );
      const guestOf = new Set(mine.map((r) => r.project_id));
      for (const p of list) {
        if (guestOf.has(p.id) && !visible.includes(p)) visible.push(p);
      }
      visible.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    }

    res.json(
      visible.map((p) => ({
        id: p.id,
        name: p.name,
        nameEn: p.name_en || '',
        cadence: p.cadence || '',
        color: p.color || '',
        count: byId.get(p.id) || 0,
        canSee: true,
        builtin: !!p.builtin,
        isPublic: p.visibility === 'public',
        // doc_id is exposed to admins only, and only as provenance for rows
        // that predate 2026-07-19. Nothing reads back from the Doc.
        docId: admin ? p.doc_id || '' : '',
      }))
    );
  })
);

router.post(
  '/projects',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const { name, nameEn, cadence } = createProjectSchema.parse(req.body);

    const existing = await rows('select id from minutes.projects');
    const id = slugifyProjectId(nameEn || name, existing.map((p) => p.id));

    const palette = ['#0969da', '#8250df', '#1a7f37', '#9a6700', '#cf222e', '#0b3d62', '#6639ba', '#116329'];
    const color = palette[existing.length % palette.length];
    const next = await one('select coalesce(max(sort_order), 0) + 1 as n from minutes.projects');

    const created = await tx(async (c) => {
      const { rows: r } = await c.query(
        `insert into minutes.projects (id, name, name_en, cadence, color, sort_order, builtin, visibility)
         values ($1, $2, $3, $4, $5, $6, false, 'locked')
         returning id, name, name_en, cadence, color, sort_order, visibility`,
        [id, name, nameEn, cadence, color, next.n]
      );
      await audit(c, req.user.email, 'create_project', 'project', id, { name });
      return r[0];
    });

    // New projects are tag-only buckets: no Doc is created (regression guard —
    // "+ New project" used to mint a surprise Doc nobody wanted, 2026-07-19).
    res.status(201).json({
      id: created.id,
      name: created.name,
      nameEn: created.name_en || '',
      cadence: created.cadence || '',
      color: created.color,
      order: created.sort_order,
      docId: '',
      docUrl: '',
    });
  })
);

router.patch(
  '/projects/:id',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const patch = renameProjectSchema.parse(req.body);

    // coalesce($n, col) keeps every omitted field untouched in one statement,
    // rather than assembling SQL from whichever keys happened to be present.
    const updated = await one(
      `update minutes.projects
          set name    = coalesce($2, name),
              name_en = coalesce($3, name_en),
              cadence = coalesce($4, cadence),
              color   = coalesce($5, color)
        where id = $1
        returning id, name, name_en, cadence, color, sort_order, visibility`,
      [req.params.id, patch.name ?? null, patch.nameEn ?? null, patch.cadence ?? null, patch.color ?? null]
    );
    if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });

    await tx((c) => audit(c, req.user.email, 'rename_project', 'project', req.params.id, patch));

    res.json({
      id: updated.id,
      name: updated.name,
      nameEn: updated.name_en || '',
      cadence: updated.cadence || '',
      color: updated.color,
      isPublic: updated.visibility === 'public',
    });
  })
);

router.delete(
  '/projects/:id',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    // The original five are protected: they carry the Doc-era history and
    // deleting one would cascade away its guest list and orphan its minutes.
    const proj = await one('select id, builtin from minutes.projects where id = $1', [req.params.id]);
    if (!proj) return res.status(404).json({ error: 'NOT_FOUND' });
    if (proj.builtin) return res.status(409).json({ error: 'PROJECT_BUILTIN' });

    const held = await one('select 1 from minutes.minutes where project_id = $1 limit 1', [req.params.id]);
    if (held) return res.status(409).json({ error: 'PROJECT_NOT_EMPTY' });

    await tx(async (c) => {
      await c.query('delete from minutes.projects where id = $1', [req.params.id]);
      await audit(c, req.user.email, 'delete_project', 'project', req.params.id);
    });
    res.json({ ok: true });
  })
);

/* ----------------------------- project access ----------------------------- */
//
// "guest lists readable by editors" / "writable by admins".

router.get(
  '/projects/:id/access',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const proj = await one(
      'select id, name, name_en, color, visibility from minutes.projects where id = $1',
      [req.params.id]
    );
    if (!proj) return res.status(404).json({ error: 'NOT_FOUND' });

    const guests = await rows(
      'select email from minutes.project_guests where project_id = $1 order by email',
      [req.params.id]
    );

    res.json({
      id: proj.id,
      name: proj.name,
      nameEn: proj.name_en || '',
      color: proj.color || '',
      isPublic: proj.visibility === 'public',
      emails: guests.map((g) => g.email),
    });
  })
);

router.put(
  '/projects/:id/visibility',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const { isPublic } = projectVisibilitySchema.parse(req.body);

    await tx(async (c) => {
      const { rowCount } = await c.query(
        'update minutes.projects set visibility = $2 where id = $1',
        [req.params.id, isPublic ? 'public' : 'locked']
      );
      if (!rowCount) {
        const err = new Error('Project not found');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      // Unlocking publishes every meeting already in the project; locking only
      // stops the future default and leaves published rows alone. Asymmetric on
      // purpose — matches setProjectPublic in the original Auth.js.
      if (isPublic) {
        await c.query('update minutes.minutes set visible = true where project_id = $1', [req.params.id]);
      }
      await audit(c, req.user.email, 'set_project_visibility', 'project', req.params.id, { isPublic });
    });

    res.json({ ok: true, isPublic });
  })
);

router.post(
  '/projects/:id/guests',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    // Accepts either one email or a pasted batch, because the UI offers both.
    const body = req.body?.emails != null ? guestsSchema.parse(req.body) : guestSchema.parse(req.body);

    const parts = body.emails
      ? String(body.emails).split(/[\s,;]+/).filter(Boolean)
      : [body.email];

    const bad = parts.filter((e) => !z.string().email().safeParse(e).success);
    if (bad.length) return res.status(400).json({ error: 'INVALID_EMAIL', emails: bad });

    await tx(async (c) => {
      for (const email of parts) {
        await c.query(
          `insert into minutes.project_guests (project_id, email)
           values ($1, $2)
           on conflict (project_id, email) do nothing`,
          [req.params.id, email.toLowerCase()]
        );
      }
      await audit(c, req.user.email, 'add_guests', 'project', req.params.id, { emails: parts });
    });

    const guests = await rows(
      'select email from minutes.project_guests where project_id = $1 order by email',
      [req.params.id]
    );
    res.json({ emails: guests.map((g) => g.email) });
  })
);

router.delete(
  '/projects/:id/guests/:email',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    await tx(async (c) => {
      await c.query(
        'delete from minutes.project_guests where project_id = $1 and lower(email) = lower($2)',
        [req.params.id, req.params.email]
      );
      await audit(c, req.user.email, 'remove_guest', 'project', req.params.id, { email: req.params.email });
    });

    const guests = await rows(
      'select email from minutes.project_guests where project_id = $1 order by email',
      [req.params.id]
    );
    res.json({ emails: guests.map((g) => g.email) });
  })
);

/* -------------------------------- meetings -------------------------------- */

/**
 * The meeting list.
 *
 * Direct port of "minutes readable per project access": a row is readable when
 * its project is readable AND it is marked visible — unless the caller is an
 * editor/admin, who also see hidden rows. Rows tagged into a readable project
 * are reachable through that project too.
 */
router.get(
  '/meetings',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const editor = isEditor(req);
    const email = emailOf(req);
    const projectId = req.query.projectId ? projectIdSchema.parse(req.query.projectId) : null;

    const list = await rows(
      `select m.id, m.project_id, m.meeting_key, m.meeting_date, m.date_label, m.time,
              m.title, m.kind, m.excerpt, m.fathom_url, m.attendees, m.source,
              m.visible, m.pinned, m.tagged_project_ids, m.attachments
         from minutes.minutes m
        where ($1::boolean or (
                m.visible and (
                  exists (select 1 from minutes.projects p
                           where p.id = m.project_id and p.visibility = 'public')
               or ($2 <> '' and exists (select 1 from minutes.project_guests g
                           where g.project_id = m.project_id and lower(g.email) = $2))
               or exists (
                    select 1 from unnest(m.tagged_project_ids) t(pid)
                     join minutes.projects p2 on p2.id = t.pid
                    where p2.visibility = 'public'
                       or ($2 <> '' and exists (select 1 from minutes.project_guests g2
                                where g2.project_id = t.pid and lower(g2.email) = $2)))
                )))
          and ($3::text is null or m.project_id = $3 or $3 = any(m.tagged_project_ids))
        order by m.pinned desc, m.meeting_date desc nulls last, m.created_at desc`,
      [editor, email, projectId]
    );

    // A tagged copy must not surface a project the caller cannot read, so the
    // expansion is filtered by the same tier test the query used.
    const readable = editor ? null : new Set(await readableProjectIds(req));
    const items = list.flatMap((r) => expandListRow(r, readable ? (pid) => readable.has(pid) : null));

    res.json(projectId ? items.filter((i) => i.projectId === projectId) : items);
  })
);

/**
 * Full-content search. The list payload carries only title/dateLabel/excerpt,
 * so a term buried in the body never matched a client-side filter. Returns ids
 * only — the client already holds the list rows.
 */
router.get(
  '/meetings/search',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const { q } = searchSchema.parse(req.query);
    const editor = isEditor(req);
    const email = emailOf(req);

    const hits = await rows(
      `select m.id
         from minutes.minutes m
        where ($1::boolean or (
                m.visible and (
                  exists (select 1 from minutes.projects p
                           where p.id = m.project_id and p.visibility = 'public')
               or ($2 <> '' and exists (select 1 from minutes.project_guests g
                           where g.project_id = m.project_id and lower(g.email) = $2)))))
          and (
                m.title ilike '%' || $3 || '%'
             or coalesce(m.date_label, '') ilike '%' || $3 || '%'
             or coalesce(m.content_html, '') ilike '%' || $3 || '%'
             or exists (select 1 from jsonb_array_elements_text(m.attendees) a(v)
                         where a.v ilike '%' || $3 || '%'))
        order by m.meeting_date desc nulls last`,
      [editor, email, q]
    );

    res.json(hits.map((h) => h.id));
  })
);

/** One meeting, full record including body HTML. */
router.get(
  '/meetings/:id',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const m = await one(
      `select m.*, p.name as project_name, p.visibility
         from minutes.minutes m
         join minutes.projects p on p.id = m.project_id
        where m.id = $1`,
      [req.params.id]
    );
    // 404 rather than 403 for a row the caller may not read: the id itself is
    // not something a locked project should confirm.
    if (!m) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!isEditor(req)) {
      if (!m.visible) return res.status(404).json({ error: 'NOT_FOUND' });
      let ok = await canReadProject(req, m.project_id);
      if (!ok) {
        for (const pid of m.tagged_project_ids || []) {
          if (await canReadProject(req, pid)) {
            ok = true;
            break;
          }
        }
      }
      if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json({
      id: m.id,
      projectId: m.project_id,
      projectName: m.project_name,
      title: m.title || '',
      kind: m.kind || 'meeting',
      date: m.meeting_date ? new Date(m.meeting_date).toISOString().slice(0, 10) : '',
      dateLabel: m.date_label || '',
      time: m.time || '',
      pinned: !!m.pinned,
      visible: !!m.visible,
      taggedProjectIds: m.tagged_project_ids || [],
      fathomUrl: m.fathom_url || '',
      source: m.source || 'manual',
      attendees: m.attendees || [],
      html: m.content_html || '',
      css: '',
      // Always ''. The Doc is no longer the source of truth and linking to it
      // would invite someone to edit there, where nothing flows back.
      docUrl: '',
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      attachments: m.attachments || [],
      comments: m.comments || [],
    });
  })
);

/** Create or update a meeting. */
router.post(
  '/meetings',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const body = saveMeetingSchema.parse(req.body);
    const excerpt = stripTags(body.html).slice(0, 200);
    const attendees = extractAttendees(body.html);
    const iso = parseDateLabel(body.dateLabel);

    const saved = await tx(async (c) => {
      if (body.id) {
        const { rows: existing } = await c.query(
          'select id, source, content_html, title, date_label, time from minutes.minutes where id = $1',
          [body.id]
        );
        if (existing.length) {
          const prev = existing[0];
          // Snapshot the pre-edit state — content AND the metadata as it was at
          // that moment. Versioning only the body made "View Original" show the
          // row's *current* title after a rename (confirmed bug, 2026-07-22).
          if (prev.content_html) {
            await c.query(
              `insert into minutes.versions (minute_id, snapshot, taken_by)
               values ($1, $2, $3)`,
              [
                prev.id,
                JSON.stringify({
                  html: prev.content_html,
                  title: prev.title,
                  dateLabel: prev.date_label,
                  time: prev.time,
                }),
                req.user.email,
              ]
            );
          }
          const { rows: upd } = await c.query(
            `update minutes.minutes
                set project_id   = $2,
                    title        = $3,
                    date_label   = $4,
                    meeting_date = coalesce($5::date, meeting_date),
                    time         = $6,
                    excerpt      = $7,
                    fathom_url   = $8,
                    attendees    = $9::jsonb,
                    content_html = $10,
                    -- A row that came from Docs keeps that provenance forever.
                    -- Nothing may ever set source back TO 'doc-import'.
                    source       = case when source = 'doc-import' then 'doc-import' else $11 end,
                    updated_at   = now()
              where id = $1
              returning id`,
            [
              body.id,
              body.projectId,
              body.title,
              body.dateLabel,
              iso,
              body.time,
              excerpt,
              body.fathomUrl,
              JSON.stringify(attendees),
              body.html,
              body.source,
            ]
          );
          await audit(c, req.user.email, 'edit_content', 'meeting', body.id, { title: body.title });
          return upd[0];
        }
      }

      // visible is an admin-only field (the old minutes_guard trigger). An
      // editor's new row starts hidden regardless of what they asked for.
      const visible = isAdmin(req) ? !!body.visible : false;
      const id = body.id || crypto.randomUUID();
      const { rows: ins } = await c.query(
        `insert into minutes.minutes
           (id, project_id, meeting_key, meeting_date, date_label, time, title, kind,
            excerpt, fathom_url, attendees, source, visible, pinned, content_html)
         values ($1, $2, $3, $4::date, $5, $6, $7, 'meeting',
                 $8, $9, $10::jsonb, $11, $12, false, $13)
         returning id`,
        [
          id,
          body.projectId,
          `manual-${Date.now()}`,
          iso,
          body.dateLabel,
          body.time,
          body.title || 'Untitled meeting',
          excerpt,
          body.fathomUrl,
          JSON.stringify(attendees),
          body.source,
          visible,
          body.html,
        ]
      );
      await audit(c, req.user.email, 'create_meeting', 'meeting', id, {
        title: body.title,
        projectId: body.projectId,
      });
      return ins[0];
    });

    res.json({ id: saved.id });
  })
);

/** Body-only edit, with an optional metadata fix in the same save. */
router.put(
  '/meetings/:id/content',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const { html, meta } = saveEditSchema.parse(req.body);

    const ok = await tx(async (c) => {
      const { rows: existing } = await c.query(
        'select id, content_html, title, date_label, time from minutes.minutes where id = $1 for update',
        [req.params.id]
      );
      if (!existing.length) return false;
      const prev = existing[0];

      if (prev.content_html) {
        await c.query(
          'insert into minutes.versions (minute_id, snapshot, taken_by) values ($1, $2, $3)',
          [
            prev.id,
            JSON.stringify({
              html: prev.content_html,
              title: prev.title,
              dateLabel: prev.date_label,
              time: prev.time,
            }),
            req.user.email,
          ]
        );
      }

      const iso = meta?.dateLabel ? parseDateLabel(meta.dateLabel) : null;
      await c.query(
        `update minutes.minutes
            set content_html = $2,
                excerpt      = $3,
                attendees    = $4::jsonb,
                title        = coalesce($5, title),
                date_label   = coalesce($6, date_label),
                meeting_date = coalesce($7::date, meeting_date),
                time         = coalesce($8, time),
                updated_at   = now()
          where id = $1`,
        [
          req.params.id,
          html,
          stripTags(html).slice(0, 200),
          JSON.stringify(extractAttendees(html)),
          meta?.title ?? null,
          meta?.dateLabel ?? null,
          iso,
          meta?.time ?? null,
        ]
      );
      await audit(c, req.user.email, 'edit_content', 'meeting', req.params.id, meta || null);
      return true;
    });

    if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

/**
 * Pin and visibility are admin-only.
 *
 * This is the minutes_guard trigger, which existed because RLS cannot compare
 * old and new values per column. Here the split is simply a separate route with
 * a stricter guard, so an editor's save above can never touch either field.
 */
router.put(
  '/meetings/:id/pin',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const r = await one(
      'update minutes.minutes set pinned = not pinned, updated_at = now() where id = $1 returning pinned',
      [req.params.id]
    );
    if (!r) return res.status(404).json({ error: 'NOT_FOUND' });
    await tx((c) => audit(c, req.user.email, 'toggle_pin', 'meeting', req.params.id, { pinned: r.pinned }));
    res.json({ pinned: r.pinned });
  })
);

router.put(
  '/meetings/:id/visibility',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const { visible } = visibilitySchema.parse(req.body);
    const r = await one(
      'update minutes.minutes set visible = $2, updated_at = now() where id = $1 returning visible',
      [req.params.id, visible]
    );
    if (!r) return res.status(404).json({ error: 'NOT_FOUND' });
    await tx((c) => audit(c, req.user.email, 'set_visibility', 'meeting', req.params.id, { visible }));
    res.json({ visible: r.visible });
  })
);

/**
 * Delete. Editor or admin — the original's deleteMeeting(id, token) in
 * Code.js guards with isEditorOrAdmin_(token), and the access page's own copy
 * spells it out: "Editors can edit meeting content, add/remove attachments,
 * create/delete meetings, and file Fathom/Transkriptor recordings into
 * projects." Admin-only here was a port regression, not a deliberate
 * tightening — it silently took away a capability editors already had.
 */
router.delete(
  '/meetings/:id',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const ok = await tx(async (c) => {
      const { rows: r } = await c.query(
        'delete from minutes.minutes where id = $1 returning id, title, project_id',
        [req.params.id]
      );
      if (!r.length) return false;
      await audit(c, req.user.email, 'delete_meeting', 'meeting', req.params.id, {
        title: r[0].title,
        projectId: r[0].project_id,
      });
      return true;
    });
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

/* ------------------------------ inbox tagging ----------------------------- */
//
// An inbox recording never leaves its inbox: project_id is permanent and
// tagging only adds to tagged_project_ids. That is why these are their own
// routes rather than a project_id update.

const INBOX_IDS = ['FATHOM_INBOX', 'TRANSKRIPTOR_INBOX'];

router.post(
  '/meetings/:id/tags',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const { projectId } = tagSchema.parse(req.body);
    if (INBOX_IDS.includes(projectId)) return res.status(400).json({ error: 'CANNOT_TAG_INBOX' });

    const target = await one('select id from minutes.projects where id = $1', [projectId]);
    if (!target) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });

    const m = await one('select id, project_id from minutes.minutes where id = $1', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'NOT_FOUND' });
    if (!INBOX_IDS.includes(m.project_id)) return res.status(409).json({ error: 'NOT_AN_INBOX_ROW' });

    const updated = await tx(async (c) => {
      const { rows: r } = await c.query(
        `update minutes.minutes
            set tagged_project_ids = case
                  when $2::text = any(tagged_project_ids) then tagged_project_ids
                  else array_append(tagged_project_ids, $2::text)
                end,
                updated_at = now()
          where id = $1
          returning tagged_project_ids`,
        [req.params.id, projectId]
      );
      await audit(c, req.user.email, 'tag', 'meeting', req.params.id, { projectId });
      return r[0];
    });

    res.json({ taggedProjectIds: updated.tagged_project_ids });
  })
);

router.delete(
  '/meetings/:id/tags/:projectId',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const updated = await tx(async (c) => {
      const { rows: r } = await c.query(
        `update minutes.minutes
            set tagged_project_ids = array_remove(tagged_project_ids, $2::text),
                updated_at = now()
          where id = $1
          returning tagged_project_ids`,
        [req.params.id, req.params.projectId]
      );
      if (!r.length) return null;
      await audit(c, req.user.email, 'untag', 'meeting', req.params.id, { projectId: req.params.projectId });
      return r[0];
    });
    if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ taggedProjectIds: updated.tagged_project_ids });
  })
);

/* ------------------------------- attachments ------------------------------ */
//
// Metadata only. The file itself goes to Supabase Storage from the client and
// this records the resulting link — the old app put it in Drive and stored the
// share URL, same division of labour. Uploading bytes through this JSON API
// would mean a 33% base64 tax on a 25MB cap against a 2mb body limit.

export const ATTACHMENTS_BUCKET = 'meeting-attachments';

// Signed into the upload URL so the stored object is the type that was
// declared. Deliberately narrower than "anything a browser can pick": these are
// meeting documents, and an upload URL that will accept any content type is an
// open file host with extra steps.
const ATTACHMENT_CONTENT_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
};

const uploadUrlQuery = z.object({
  filename: z.string().min(1).max(255),
  ext: z.enum(Object.keys(ATTACHMENT_CONTENT_TYPES)),
});

/**
 * A URL the browser can PUT one attachment to, before POSTing its metadata.
 *
 * The object key is random rather than derived from the filename. Thai
 * filenames are normal here, and sanitising an unbounded character set well
 * enough to be a safe path is a losing game — the original name is kept in the
 * database instead, where it is data rather than a path.
 *
 * Editor-gated like the metadata write it precedes: an anonymous reader who
 * could obtain an upload URL could store files against a meeting they may only
 * read.
 */
router.get(
  '/meetings/:id/attachments/upload-url',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const q = uploadUrlQuery.parse(req.query);

    const meeting = await one('select id from minutes.minutes where id = $1', [req.params.id]);
    if (!meeting) return res.status(404).json({ error: 'NOT_FOUND' });

    const path = safeKey(`${req.params.id}`, q.filename, randomToken(16));

    try {
      const [uploadUrl, downloadUrl] = await Promise.all([
        presignUpload(ATTACHMENTS_BUCKET, path, ATTACHMENT_CONTENT_TYPES[q.ext]),
        presignDownload(ATTACHMENTS_BUCKET, path),
      ]);
      // contentType is returned because the PUT must send EXACTLY the type
      // that was signed into the URL. The browser file.type is not a reliable
      // substitute - it is empty for .docx on some Windows configurations, and
      // an S3 signature mismatch fails the upload with an opaque 403.
      res.json({
        bucket: ATTACHMENTS_BUCKET,
        path,
        uploadUrl,
        downloadUrl,
        contentType: ATTACHMENT_CONTENT_TYPES[q.ext],
      });
    } catch (err) {
      console.error('[minutes] could not sign attachment URLs:', err.message);
      res.status(503).json({ error: 'STORAGE_UNAVAILABLE' });
    }
  })
);

router.post(
  '/meetings/:id/attachments',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const att = attachmentSchema.parse(req.body);

    const updated = await tx(async (c) => {
      const { rows: r } = await c.query(
        `update minutes.minutes
            set attachments = attachments || $2::jsonb,
                updated_at  = now()
          where id = $1
          returning attachments`,
        [
          req.params.id,
          JSON.stringify([
            {
              fileId: crypto.randomUUID(),
              name: att.name,
              mimeType: att.mimeType,
              size: att.size,
              url: att.url,
              uploadedAt: new Date().toISOString(),
              uploadedBy: req.user.email,
            },
          ]),
        ]
      );
      if (!r.length) return null;
      await audit(c, req.user.email, 'add_attachment', 'meeting', req.params.id, { name: att.name });
      return r[0];
    });

    if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ attachments: updated.attachments });
  })
);

router.delete(
  '/meetings/:id/attachments/:fileId',
  requireAuth,
  requireRole('minutes', 'editor', 'admin'),
  asyncRoute(async (req, res) => {
    const updated = await tx(async (c) => {
      const { rows: r } = await c.query(
        `update minutes.minutes
            set attachments = coalesce((
                  select jsonb_agg(a)
                    from jsonb_array_elements(attachments) a
                   where a->>'fileId' <> $2
                ), '[]'::jsonb),
                updated_at = now()
          where id = $1
          returning attachments`,
        [req.params.id, req.params.fileId]
      );
      if (!r.length) return null;
      await audit(c, req.user.email, 'remove_attachment', 'meeting', req.params.id, { fileId: req.params.fileId });
      return r[0];
    });
    if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ attachments: updated.attachments });
  })
);

/* --------------------------------- comments ------------------------------- */
//
// Any signed-in person who can read the meeting may comment; the author or an
// admin may delete. requireAnyRole is not enough on its own here — the read
// check below is what stops a signed-in stranger commenting on a locked
// project's meeting.

router.post(
  '/meetings/:id/comments',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { text } = commentSchema.parse(req.body);

    const m = await one(
      'select id, project_id, visible, tagged_project_ids from minutes.minutes where id = $1',
      [req.params.id]
    );
    if (!m) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!isEditor(req)) {
      if (!m.visible) return res.status(404).json({ error: 'NOT_FOUND' });
      if (!(await canReadProject(req, m.project_id))) return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const updated = await tx(async (c) => {
      const { rows: r } = await c.query(
        `update minutes.minutes
            set comments = comments || $2::jsonb, updated_at = now()
          where id = $1
          returning comments`,
        [
          req.params.id,
          JSON.stringify([
            {
              id: crypto.randomUUID(),
              author: req.user.email,
              text,
              createdAt: new Date().toISOString(),
            },
          ]),
        ]
      );
      await audit(c, req.user.email, 'add_comment', 'meeting', req.params.id);
      return r[0];
    });

    res.json({ comments: updated.comments });
  })
);

router.delete(
  '/meetings/:id/comments/:commentId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const m = await one('select comments from minutes.minutes where id = $1', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'NOT_FOUND' });

    const target = (m.comments || []).find((c) => c.id === req.params.commentId);
    if (!target) return res.status(404).json({ error: 'COMMENT_NOT_FOUND' });
    if (target.author !== req.user.email && !isAdmin(req)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const updated = await tx(async (c) => {
      const { rows: r } = await c.query(
        `update minutes.minutes
            set comments = coalesce((
                  select jsonb_agg(x)
                    from jsonb_array_elements(comments) x
                   where x->>'id' <> $2
                ), '[]'::jsonb),
                updated_at = now()
          where id = $1
          returning comments`,
        [req.params.id, req.params.commentId]
      );
      await audit(c, req.user.email, 'remove_comment', 'meeting', req.params.id, { commentId: req.params.commentId });
      return r[0];
    });

    res.json({ comments: updated.comments });
  })
);

/* --------------------------- versions / audit trail ----------------------- */
//
// Admin only, all three — "versions readable by admins", "audit readable by
// admins", "fathom raw log readable by admins". The Edit History panel is an
// admin surface in the UI, and these carry pre-redaction content and raw
// third-party payloads.

router.get(
  '/meetings/:id/versions',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const list = await rows(
      `select id, taken_at, taken_by
         from minutes.versions
        where minute_id = $1
        order by taken_at desc, id desc`,
      [req.params.id]
    );
    res.json(
      list.map((v) => ({ seq: String(v.id), takenAt: v.taken_at, takenBy: v.taken_by || '' }))
    );
  })
);

/**
 * One version's content, or the live row when seq is 'current'/'original'.
 *
 * 'original' is the OLDEST snapshot — the content before the first ever edit —
 * or the live row when the meeting has never been edited, in which case current
 * genuinely is the original.
 */
router.get(
  '/meetings/:id/versions/:seq',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const { id, seq } = req.params;

    const live = async () => {
      const r = await one(
        'select content_html, title, date_label, time from minutes.minutes where id = $1',
        [id]
      );
      return r
        ? { html: r.content_html || '', title: r.title || '', dateLabel: r.date_label || '', time: r.time || '' }
        : { html: '', title: '', dateLabel: '', time: '' };
    };

    if (seq === 'current') return res.json(await live());

    if (seq === 'original') {
      const oldest = await one(
        'select snapshot from minutes.versions where minute_id = $1 order by taken_at asc, id asc limit 1',
        [id]
      );
      if (!oldest) return res.json(await live());
      return res.json(fromSnapshot(oldest.snapshot));
    }

    const n = Number(seq);
    if (!Number.isInteger(n)) return res.status(400).json({ error: 'BAD_VERSION' });

    const v = await one('select snapshot from minutes.versions where minute_id = $1 and id = $2', [id, n]);
    if (!v) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(fromSnapshot(v.snapshot));
  })
);

// Snapshots taken before the 2026-07-22 metadata-capture fix hold only html;
// '' for the missing fields is the documented contract, and the client falls
// back to the live row only in that case.
function fromSnapshot(snapshot) {
  const s = snapshot || {};
  return {
    html: s.html || '',
    title: s.title || '',
    dateLabel: s.dateLabel || '',
    time: s.time || '',
  };
}

router.get(
  '/meetings/:id/audit',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const list = await rows(
      `select id, at, actor, action, target, target_id, changes, note
         from minutes.audit_log
        where target_id = $1
        order by at desc, id desc`,
      [req.params.id]
    );
    res.json(
      list.map((e) => ({
        id: String(e.id),
        when: e.at,
        who: e.actor || '(anonymous)',
        action: e.action,
        targetType: e.target,
        targetId: e.target_id,
        details: e.changes || {},
        note: e.note || '',
      }))
    );
  })
);

/**
 * Delete one audit-log entry for a meeting. Admin only.
 *
 * Ported from deleteAuditEntries(targetId, whens, token) in Code.js — the
 * original deleted by a list of `when` timestamps in one call (its sheet had
 * no row id); this schema's audit_log has a real primary key, so each row is
 * deleted individually instead, matching this API's REST conventions
 * elsewhere. "Clear all" (below) is the bulk case the original also offered.
 *
 * The original additionally deleted any version snapshot the entry's
 * `details.versionSeq` pointed at, so pruning noisy edit-history entries did
 * not leave orphaned, unreachable snapshots behind. This schema's
 * minutes.versions rows are not linked from audit_log at all — they are
 * their own independent list, exactly as EditHistoryModal.jsx already shows
 * them — so there is nothing here to cascade; a version is deleted with its
 * own DELETE /versions/:seq route instead.
 */
router.delete(
  '/meetings/:id/audit/:entryId',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const deleted = await rows(
      `delete from minutes.audit_log where id = $1 and target_id = $2 returning id`,
      [req.params.entryId, req.params.id]
    );
    if (!deleted.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

/** Delete every audit-log entry for a meeting. Admin only. */
router.delete(
  '/meetings/:id/audit',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    await rows('delete from minutes.audit_log where target_id = $1', [req.params.id]);
    res.json({ ok: true });
  })
);

/** Delete one content snapshot. Admin only. */
router.delete(
  '/meetings/:id/versions/:seq',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const n = Number(req.params.seq);
    if (!Number.isInteger(n)) return res.status(400).json({ error: 'BAD_VERSION' });
    const deleted = await rows(
      `delete from minutes.versions where id = $1 and minute_id = $2 returning id`,
      [n, req.params.id]
    );
    if (!deleted.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

/** The whole audit log, newest first. Admin only. */
router.get(
  '/audit',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const list = await rows(
      `select at, actor, action, target, target_id, changes, note
         from minutes.audit_log
        order by at desc, id desc
        limit $1`,
      [limit]
    );
    res.json(
      list.map((e) => ({
        when: e.at,
        who: e.actor || '(anonymous)',
        action: e.action,
        targetType: e.target,
        targetId: e.target_id,
        details: e.changes || {},
        note: e.note || '',
      }))
    );
  })
);

/**
 * Raw Fathom webhook payloads. Admin only, and read-only here — writes arrive
 * from the server-side ingest, never from a browser, so there is no POST.
 */
router.get(
  '/fathom-raw-log',
  requireAuth,
  requireRole('minutes', 'admin'),
  asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const recordingId = req.query.recordingId ? String(req.query.recordingId) : null;

    const list = await rows(
      `select id, received_at, recording_id, payload
         from minutes.fathom_raw_log
        where ($1::text is null or recording_id = $1)
        order by received_at desc, id desc
        limit $2`,
      [recordingId, limit]
    );
    res.json(list);
  })
);

/* --------------------------------- helpers -------------------------------- */

/** Port of slugifyProjectId_: initials of a multi-word name, else the first
 *  four characters, uppercased — matching the hardcoded ids (FIN, BT12). */
function slugifyProjectId(name, existingIds) {
  const ascii = String(name).replace(/[^\x00-\x7F]/g, '');
  const words = ascii.split(/[\s\-_]+/).filter(Boolean);
  let base = (words.length > 1 ? words.map((w) => w[0]).join('') : ascii.slice(0, 4))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!base) base = 'PROJ';
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(base + n)) n++;
  return base + n;
}

export default router;
