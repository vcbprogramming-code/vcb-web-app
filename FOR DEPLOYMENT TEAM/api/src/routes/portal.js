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


/**
 * Which apps may this caller administer access for?
 *
 * The senior role in each app carries the right to manage that app's own
 * access — an HR admin manages HR access, a minutes admin manages minutes
 * access. That is what makes "access rights from within each app's settings"
 * work without every module needing a portal admin standing by.
 *
 * A portal admin is handled by the caller, not here: they administer
 * everything, and expressing that as "every key in this map" would silently
 * stop being true the moment an app was added without a role.
 */
function adminableApps(user) {
  const OWNER_ROLE = {
    hr: 'admin',
    minutes: 'admin',
    credit: 'manager',
    sop: 'editor',
    portal: 'admin',
  };
  const roles = user?.roles || {};
  return Object.entries(OWNER_ROLE)
    .filter(([app, needed]) => roles[app] === needed)
    .map(([app]) => app);
}

/* ------------------------------ access rights ----------------------------- */

// Administering who may use which app.
//
// TWO PLACES USE THESE ENDPOINTS, deliberately:
//
//   * The portal's own settings — the whole picture. Every person, every app,
//     one screen. This is where you answer "what can Somchai get to?".
//   * Each app's settings — its own slice, scoped by ?app=hr. This is where an
//     HR admin manages HR access without being handed the credit facility.
//
// Same endpoints, same data, different scope. The alternative — a separate
// admin surface per module — is six places to fix a bug and six chances for
// them to disagree about what a role means.
//
// NOT ENFORCED YET. portal.access_grants is written here and read by the admin
// screens, but api/src/auth.js resolveRoles() still reads the per-module tables
// (hr.users, credit.managers, …). Populate and check this first; switching
// resolveRoles() over is a separate change, so that a mistake in the new table
// cannot lock the company out of its own portal. See supabase/migrations/008.

const appKey = z.string().min(1).max(64);
const emailSchema = z.string().email().max(320);

/**
 * The role vocabulary, per app.
 *
 * The admin screen renders a dropdown from this rather than hard-coding role
 * names, so an app that gains a role gains it in the UI without a deploy.
 * Anonymous-readable: it is a list of words, and the sign-in screen has no
 * token to send yet.
 */
router.get(
  '/access/roles',
  allowAnonymous,
  asyncRoute(async (req, res) => {
    const q = z.object({ app: appKey.optional() }).parse(req.query);
    const list = await rows(
      `select r.app_key, r.role, r.label, r.label_th, r.description, r.rank,
              a.name as app_name, a.name_th as app_name_th
         from portal.app_roles r
         join portal.apps a on a.key = r.app_key
        where ($1::text is null or r.app_key = $1)
        order by a.sort_order, r.rank desc`,
      [q.app ?? null]
    );
    res.json(list);
  })
);

/**
 * Who has access to what.
 *
 * ?app=hr narrows to one app, which is what an app's own settings screen
 * sends. ?email= narrows to one person, which is what you want when someone
 * asks "why can't I open Credit?".
 *
 * Portal admins see everything. An app admin sees only their app — enforced
 * here rather than trusted from the query string, because ?app is a client
 * input and "only send us your own app" is not a security boundary.
 */
router.get(
  '/access/grants',
  requireAuth,
  asyncRoute(async (req, res) => {
    const q = z
      .object({ app: appKey.optional(), email: z.string().max(320).optional() })
      .parse(req.query);

    const isPortalAdmin = req.user?.roles?.portal === 'admin';
    // The apps this caller may administer: all of them for a portal admin,
    // otherwise the ones where they hold the most senior role.
    const mine = adminableApps(req.user);

    if (!isPortalAdmin && q.app && !mine.includes(q.app)) {
      return res.status(403).json({ error: 'FORBIDDEN', app: q.app });
    }
    const scope = isPortalAdmin ? null : mine;

    const list = await rows(
      `select g.email, g.app_key, g.role, g.granted_by, g.granted_at, g.note,
              r.label, r.label_th
         from portal.access_grants g
         left join portal.app_roles r on r.app_key = g.app_key and r.role = g.role
        where ($1::text is null or g.app_key = $1)
          and ($2::text is null or lower(g.email) = lower($2))
          and ($3::text[] is null or g.app_key = any($3))
        order by lower(g.email), g.app_key`,
      [q.app ?? null, q.email ?? null, scope]
    );
    res.json(list);
  })
);

/**
 * Everything one person can reach, across every app.
 *
 * The shape the portal's per-person screen wants: one row per app, with the
 * granted role or null. Apps with no roles defined come back with
 * roles: [] — "everyone who can sign in may use it" — rather than being
 * omitted, so the screen shows the complete picture instead of implying an app
 * does not exist.
 */
router.get(
  '/access/person/:email',
  requireAuth,
  asyncRoute(async (req, res) => {
    const email = emailSchema.parse(req.params.email);
    const list = await rows(
      `select a.key as app_key, a.name, a.name_th, a.sort_order,
              g.role, g.granted_by, g.granted_at, g.note,
              coalesce(
                (select json_agg(json_build_object(
                          'role', r.role, 'label', r.label,
                          'label_th', r.label_th, 'rank', r.rank)
                        order by r.rank desc)
                   from portal.app_roles r where r.app_key = a.key),
                '[]'::json
              ) as roles
         from portal.apps a
         left join portal.access_grants g
                on g.app_key = a.key and lower(g.email) = lower($1)
        where a.enabled
        order by a.sort_order, a.name`,
      [email]
    );
    res.json({ email, apps: list });
  })
);

const grantSchema = z.object({
  email: emailSchema,
  app: appKey,
  // null revokes. Sending role: null rather than DELETE keeps the admin screen
  // to one verb: it always PUTs the state it wants.
  role: z.string().min(1).max(64).nullable(),
  note: z.string().max(500).optional(),
});

/**
 * Grant, change, or revoke one person's role in one app.
 *
 * Idempotent: PUT the state you want. The trigger on portal.access_grants
 * writes portal.access_audit either way, including the delete, so a revocation
 * leaves a record even though the grant row is gone.
 */
router.put(
  '/access/grants',
  requireAuth,
  asyncRoute(async (req, res) => {
    const g = grantSchema.parse(req.body);

    const isPortalAdmin = req.user?.roles?.portal === 'admin';
    if (!isPortalAdmin && !adminableApps(req.user).includes(g.app)) {
      return res.status(403).json({ error: 'FORBIDDEN', app: g.app });
    }

    // Refuse a role the app does not define, rather than storing a typo that
    // silently grants nothing. The FK would catch it too; this says why.
    if (g.role) {
      const known = await one(
        'select 1 from portal.app_roles where app_key = $1 and role = $2',
        [g.app, g.role]
      );
      if (!known) {
        return res.status(400).json({ error: 'UNKNOWN_ROLE', app: g.app, role: g.role });
      }
    }

    const saved = await tx(req.user, async (c) => {
      if (!g.role) {
        await c.query('delete from portal.access_grants where lower(email) = lower($1) and app_key = $2',
          [g.email, g.app]);
        return null;
      }
      const { rows: r } = await c.query(
        `insert into portal.access_grants (email, app_key, role, granted_by, note)
         values (lower($1), $2, $3, $4, $5)
         on conflict (email, app_key) do update
            set role = excluded.role,
                granted_by = excluded.granted_by,
                granted_at = now(),
                note = excluded.note
         returning *`,
        [g.email, g.app, g.role, req.user?.email ?? null, g.note ?? null]
      );
      return r[0];
    });

    res.json(saved ?? { email: g.email.toLowerCase(), app_key: g.app, role: null });
  })
);

/**
 * The change history for one person, or for one app.
 *
 * Read-only by construction: rows are written by a database trigger, and an
 * endpoint that let a client write them would make the log worthless as
 * evidence of who granted what.
 */
router.get(
  '/access/audit',
  requireAuth,
  requireRole('portal', 'admin'),
  asyncRoute(async (req, res) => {
    const q = z
      .object({
        email: z.string().max(320).optional(),
        app: appKey.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(req.query);

    const list = await rows(
      `select id, at, actor, email, app_key, old_role, new_role, note
         from portal.access_audit
        where ($1::text is null or lower(email) = lower($1))
          and ($2::text is null or app_key = $2)
        order by at desc
        limit $3`,
      [q.email ?? null, q.app ?? null, q.limit]
    );
    res.json(list);
  })
);

export default router;
