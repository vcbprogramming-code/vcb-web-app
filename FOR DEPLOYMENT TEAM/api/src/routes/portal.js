// Portal — the front door. An app-tile list and one announcement banner.
//
// Guards mirror the RLS policies in portal/…/supabase/schema.sql:
//   apps / announcement select → anon and authenticated, so allowAnonymous
//   apps / announcement write  → public.is_portal_admin(), so
//                                requireAuth + requireRole('portal','admin')
//
// The Apps Script version gated the admin panel on a password hash held in
// ScriptProperties. That is gone: the hash and the comparison would both sit in
// the browser bundle. The admin list plus a real token replaces it, so there is
// no unlockAdmin endpoint here by design.

import { Router } from 'express';
import { z } from 'zod';
import { rows, one, tx } from '../db.js';
import { requireAuth, requireRole, allowAnonymous } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';

const router = Router();

const admin = [requireAuth, requireRole('portal', 'admin')];

/* --------------------------------- schemas -------------------------------- */

const appSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    // The key is the primary key and the client uses it to look up icons and
    // i18n strings, so keep it to a slug rather than accepting anything.
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'lowercase letters, digits, - and _ only'),
  name: z.string().trim().min(1).max(120),
  nameTh: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().max(600).optional().default(''),
  descriptionTh: z.string().trim().max(600).optional().default(''),
  // A tile is a link the whole company clicks. Restrict the scheme so an admin
  // account cannot turn the front door into a javascript: payload.
  url: z.string().trim().url().max(2000).refine(
    (u) => /^https?:\/\//i.test(u),
    'url must be http or https'
  ),
  icon: z.string().trim().max(40).optional().default(''),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'accent must be a hex colour')
    .optional()
    .default('#4fd1ff'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  enabled: z.boolean().optional().default(true),
});

const announcementSchema = z.object({
  // Same caps as saveAnnouncement() in Code.js, so the admin UI's counters and
  // the server agree on what will fit.
  title: z.string().trim().max(120).optional().default(''),
  body: z.string().trim().max(600).optional().default(''),
  show: z.boolean().optional().default(false),
});

const listQuery = z.object({
  // Anyone may ask for disabled tiles, but only an admin is served them —
  // enforced below, not here.
  includeDisabled: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

/* ---------------------------------- shapes -------------------------------- */
// The client's AppEntry is camelCase with a single `desc`; Thai copy rides
// alongside so the UI can switch language without a second request.

const toApp = (r) => ({
  key: r.key,
  name: r.name,
  nameTh: r.name_th || '',
  desc: r.description || '',
  descTh: r.description_th || '',
  url: r.url,
  icon: r.icon || '',
  accent: r.accent || '',
  sortOrder: r.sort_order,
  enabled: r.enabled,
});

/**
 * The client keys its per-device dismissal off `id`. The schema has no uuid —
 * it bumps `revision` instead — so expose revision as the id. Same effect: the
 * value changes on every save, and a dismissed banner comes back.
 */
const toAnnouncement = (r) =>
  r && {
    id: String(r.revision),
    title: r.title || '',
    body: r.body || '',
    show: r.show,
    updated: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
  };

/* ----------------------------------- apps --------------------------------- */

router.get(
  '/apps',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const { includeDisabled } = listQuery.parse(req.query);
    // Disabled tiles are the admin's staging area — a tile pointing at a system
    // that is not live yet. Only an admin sees them, whatever the query says.
    const showAll = includeDisabled && req.user?.roles?.portal === 'admin';
    const list = await rows(
      `select key, name, name_th, description, description_th, url, icon, accent,
              sort_order, enabled
         from portal.apps
        where $1::boolean or enabled
        order by sort_order, name`,
      [showAll]
    );
    res.json(list.map(toApp));
  })
);

router.post(
  '/apps',
  admin,
  asyncRoute(async (req, res) => {
    const p = appSchema.parse(req.body);
    const row = await one(
      `insert into portal.apps
         (key, name, name_th, description, description_th, url, icon, accent, sort_order, enabled)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [p.key, p.name, p.nameTh, p.description, p.descriptionTh, p.url, p.icon, p.accent, p.sortOrder, p.enabled]
    );
    res.status(201).json(toApp(row));
  })
);

router.patch(
  '/apps/:key',
  admin,
  asyncRoute(async (req, res) => {
    // The key is the primary key and the identity the client's i18n table is
    // built around; changing it would orphan those strings, so it is not
    // patchable — delete and re-create instead.
    const p = appSchema.omit({ key: true }).partial().parse(req.body);

    const row = await one(
      `update portal.apps set
         name           = coalesce($2, name),
         name_th        = coalesce($3, name_th),
         description    = coalesce($4, description),
         description_th = coalesce($5, description_th),
         url            = coalesce($6, url),
         icon           = coalesce($7, icon),
         accent         = coalesce($8, accent),
         sort_order     = coalesce($9, sort_order),
         enabled        = coalesce($10, enabled)
       where key = $1
       returning *`,
      [
        req.params.key, p.name ?? null, p.nameTh ?? null, p.description ?? null,
        p.descriptionTh ?? null, p.url ?? null, p.icon ?? null, p.accent ?? null,
        p.sortOrder ?? null, p.enabled ?? null,
      ]
    );

    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(toApp(row));
  })
);

router.delete(
  '/apps/:key',
  admin,
  asyncRoute(async (req, res) => {
    const row = await one('delete from portal.apps where key = $1 returning key', [req.params.key]);
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  })
);

/** Bulk reorder — the admin UI drags tiles, so one call beats N patches. */
router.put(
  '/apps/order',
  admin,
  asyncRoute(async (req, res) => {
    const { keys } = z.object({ keys: z.array(z.string().min(1).max(40)).max(100) }).parse(req.body);
    await tx(async (c) => {
      // Position in the array is the new sort_order; unnest keeps it one
      // parameterised statement instead of a loop of updates.
      await c.query(
        `update portal.apps a
            set sort_order = t.ord
           from unnest($1::text[]) with ordinality as t(k, ord)
          where a.key = t.k`,
        [keys]
      );
    });
    res.json({ ok: true, count: keys.length });
  })
);

/* ------------------------------- announcement ----------------------------- */

/**
 * The banner. Anonymous callers and non-admins get it only when show=true —
 * the same rule as getAnnouncement() in Code.js; an admin gets the row either
 * way so the editor can load a hidden draft (getAnnouncementForEdit).
 */
router.get(
  '/announcement',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const row = await one(
      'select title, body, show, revision, updated_at from portal.announcement where id = 1'
    );
    if (!row) return res.json(null);
    if (!row.show && req.user?.roles?.portal !== 'admin') return res.json(null);
    res.json(toAnnouncement(row));
  })
);

router.put(
  '/announcement',
  admin,
  asyncRoute(async (req, res) => {
    const p = announcementSchema.parse(req.body);
    if (!p.title && !p.body) {
      return res.status(400).json({ error: 'EMPTY_ANNOUNCEMENT' });
    }

    // The single row may not exist on a fresh database, so upsert. `revision`
    // is left alone here — the announcement_bump trigger increments it on
    // update, and setting it explicitly would fight that trigger.
    const row = await one(
      `insert into portal.announcement (id, title, body, show, updated_by)
       values (1, $1, $2, $3, $4)
       on conflict (id) do update set
         title = excluded.title,
         body = excluded.body,
         show = excluded.show,
         updated_by = excluded.updated_by
       returning title, body, show, revision, updated_at`,
      [p.title, p.body, p.show, req.user.email]
    );
    res.json(toAnnouncement(row));
  })
);

/**
 * Clear the banner. Blanks the text rather than deleting the row, because the
 * id=1 check constraint means there is only ever one row and deleting it would
 * reset revision — re-showing an old dismissed banner to everyone.
 */
router.delete(
  '/announcement',
  admin,
  asyncRoute(async (req, res) => {
    const row = await one(
      `update portal.announcement
          set title = '', body = '', show = false, updated_by = $1
        where id = 1
        returning title, body, show, revision, updated_at`,
      [req.user.email]
    );
    if (!row) return res.json(null);
    res.json(toAnnouncement(row));
  })
);

export default router;
