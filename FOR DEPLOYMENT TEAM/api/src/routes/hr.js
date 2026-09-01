// HR Work Log.
//
// Every table here lives in the `hr` schema. Never write an unqualified
// `employees` in this file — `onboarding.employees` exists too and is a
// completely different table with a different primary key.
//
// The old schema enforced access with RLS via can_access_site()/is_hr_admin().
// The API connects as one database user, so those policies are reproduced by
// requireAuth + requireHrSite/requireRole below. A route without a guard here
// publishes another site's payroll-adjacent data to anyone with a token.
//
// TWO RULES THAT THE MONEY DEPENDS ON:
//
//   1. `slot` is not a time of day. Slot 1 is งานหลัก (the main task), slot 2 is
//      งานเสริม (optional extra work). The "AM N"/"PM N" column names in the
//      legacy sheet are historical and misleading — the app has no AM/PM split.
//   2. A day with both slots filled is still ONE manday. Counting work_entries
//      rows as mandays double-counts every two-task day and inflates every
//      workload and cost total. That is what the hr.mandays view is for; use it
//      and never recompute from work_entries.
//
// Edit-window and site-consistency rules (nobody may fill more than one day
// ahead; non-admins are locked out beyond LOCK_DAYS back; an entry must sit on
// the employee's own site) are enforced by database triggers, deliberately, so
// a direct SQL client cannot bypass them. They are NOT duplicated here — this
// file only translates the errors they raise into HTTP.

import { Router } from 'express';
import { z } from 'zod';
import { rows, one, tx } from '../db.js';
import { requireAuth, requireRole, requireHrSite } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';

const router = Router();

// Everything under /api/hr needs a signed-in user WITH an HR role. The old
// policies said `to authenticated`, but "authenticated" in the HR project meant
// someone in hr.users — one Supabase project, one audience. This API is shared
// across every module, so a bare requireAuth would let a SOP editor with no HR
// role read the whole roster. requireAnyRole is not enough here for the same
// reason. The per-site and per-role narrowing then happens on each route.
router.use(requireAuth, requireRole('hr', 'admin', 'manager', 'staff'));

/* --------------------------------- helpers -------------------------------- */

const siteKey = z.string().min(1).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd');
const slot = z.coerce.number().int().min(1).max(2);

const monthQuery = z.object({
  site: siteKey,
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/** Half-open range [from, to) covering one month, as yyyy-mm-dd. */
function monthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const to = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { from, to };
}

const isAdmin = (req) => req.user?.roles?.hr === 'admin';

/** pg returns a Date for a `date` column; the client wants yyyy-mm-dd. */
const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/**
 * enforce_entry_window raises 42501 (insufficient_privilege) when a date is
 * outside the editable window. That is a client-fixable condition, so give it a
 * 403 with the reason rather than letting it surface as a bare 500.
 */
function rethrowWindow(err) {
  if (err?.code === '42501') {
    const e = new Error(err.message);
    e.status = 403;
    e.code = 'OUTSIDE_EDIT_WINDOW';
    throw e;
  }
  throw err;
}

/**
 * The caller's site scope for the whole-estate endpoints, or null meaning
 * "every site" for an admin. Returns false when the token carries no scope —
 * refuse rather than assume, because assuming means leaking another site.
 */
function scopeFor(req, requestedSite) {
  if (isAdmin(req)) return requestedSite ? [requestedSite] : null;
  const mine = req.user?.hrSites;
  if (!Array.isArray(mine)) return false;
  // A site in the query narrows the scope; it can never widen it.
  if (requestedSite) return mine.includes(requestedSite) ? [requestedSite] : false;
  return mine;
}

/* ------------------------------ reference data ---------------------------- */

// "readable by signed-in users" in the old policy set — no site scope on the
// read itself, but the site LIST is filtered, since it is what the UI offers.
router.get(
  '/bootstrap',
  asyncRoute(async (req, res) => {
    const role = req.user.roles.hr;
    const mine = Array.isArray(req.user.hrSites) ? req.user.hrSites : [];
    const sites = isAdmin(req)
      ? await rows('select site_key, name, company, active from hr.sites order by name')
      : await rows(
          `select site_key, name, company, active
             from hr.sites
            where site_key = any($1::text[])
            order by name`,
          [mine]
        );

    const lock = await one("select value from hr.config where key = 'LOCK_DAYS'");

    res.json({
      ok: true,
      email: req.user.email,
      role,
      isAdmin: isAdmin(req),
      canEntry: ['admin', 'manager', 'staff'].includes(role),
      sites: sites.map((s) => ({
        key: s.site_key,
        name: s.name,
        company: s.company,
        active: s.active,
      })),
      lockDays: Number(lock?.value ?? 3),
    });
  })
);

// The activity catalogue and the ERP cost codes — the picker's two vocabularies.
// A codeless master_index row is legacy clutter the live app drops, so it is
// filtered here rather than in every consumer.
router.get(
  '/index',
  asyncRoute(async (_req, res) => {
    const [activities, costs] = await Promise.all([
      rows(
        `select id, code, name, description as desc, category, sites, mapping,
                fixed_cost, allowed_cost
           from hr.master_index
          where coalesce(code, '') <> ''
          order by code`
      ),
      rows('select id, code, name, name_en from hr.cost_index order by code'),
    ]);
    res.json({ activities, costs });
  })
);

const activitySchema = z.object({
  id: z.string().min(1).max(64),
  code: z.string().min(1).max(64),
  name: z.string().max(500).optional(),
  desc: z.string().max(2000).optional(),
  category: z.string().max(200).optional(),
  sites: z.array(siteKey).optional(),
  mapping: z.enum(['one-to-one', 'one-to-many']),
  fixed_cost: z.number().nullable().optional(),
  allowed_cost: z.number().nullable().optional(),
});

// "<table> writable by admins" — reference data is admin-only for every verb
// but select.
router.put(
  '/index/activity',
  requireRole('hr', 'admin'),
  asyncRoute(async (req, res) => {
    const a = activitySchema.parse(req.body);
    const row = await one(
      `insert into hr.master_index
         (id, code, name, description, category, sites, mapping, fixed_cost, allowed_cost)
       values ($1, $2, $3, $4, $5, coalesce($6::text[], '{}'), $7, $8, $9)
       on conflict (id) do update set
         code = excluded.code, name = excluded.name, description = excluded.description,
         category = excluded.category, sites = excluded.sites, mapping = excluded.mapping,
         fixed_cost = excluded.fixed_cost, allowed_cost = excluded.allowed_cost
       returning *`,
      [
        a.id,
        a.code,
        a.name ?? null,
        a.desc ?? null,
        a.category ?? null,
        a.sites ?? null,
        a.mapping,
        a.fixed_cost ?? null,
        a.allowed_cost ?? null,
      ]
    );
    res.json(row);
  })
);

/* ----------------------------------- sites -------------------------------- */

// The admin projects table. It carries the still-assigned headcount so closing
// a project can warn how many people are on it — a warning, not a block,
// because projects routinely end before HR moves staff.
router.get(
  '/sites',
  requireRole('hr', 'admin'),
  asyncRoute(async (_req, res) => {
    const list = await rows(
      `select s.site_key, s.name, s.company, s.active,
              (select count(*) from hr.employees e where e.site_key = s.site_key)::int as emps
         from hr.sites s
        order by s.name`
    );
    res.json(
      list.map((s) => ({
        key: s.site_key,
        name: s.name,
        company: s.company,
        active: s.active,
        emps: s.emps,
      }))
    );
  })
);

const addSiteSchema = z.object({
  key: siteKey.regex(/^[a-z0-9]+$/, 'site key must be lowercase ASCII'),
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
});

// The key is a permanent internal id (it was the wide-tab suffix and is still
// hr.users.site_key and every entry's foreign key), so it must stay ASCII and
// is never derived from the Thai name here — the client sends both. A duplicate
// key surfaces as 23505 → 409 from the shared error handler.
router.post(
  '/sites',
  requireRole('hr', 'admin'),
  asyncRoute(async (req, res) => {
    const s = addSiteSchema.parse(req.body);
    const row = await one(
      `insert into hr.sites (site_key, name, company, active)
       values ($1, $2, $3, true)
       returning site_key, name, company, active`,
      [s.key, s.name.trim(), s.company?.trim() || null]
    );
    res.status(201).json({ key: row.site_key, name: row.name, company: row.company, active: row.active });
  })
);

// Closing a project keeps its dashboard history; it only stops being offered
// for new entries.
router.patch(
  '/sites/:siteKey',
  requireRole('hr', 'admin'),
  asyncRoute(async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const row = await one(
      'update hr.sites set active = $2 where site_key = $1 returning site_key, active',
      [req.params.siteKey, active]
    );
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true, key: row.site_key, active: row.active });
  })
);

/* --------------------------------- employees ------------------------------ */

// "employees readable within site".
router.get(
  '/sites/:siteKey/employees',
  requireHrSite(),
  asyncRoute(async (req, res) => {
    const list = await rows(
      `select e.eid, e.emp_id, e.name, e.position, e.department, e.kind, e.division,
              e.email, e.site_key, s.company
         from hr.employees e
         left join hr.sites s on s.site_key = e.site_key
        where e.site_key = $1
        order by (e.kind = 'operation') desc, e.name`,
      [req.params.siteKey]
    );
    res.json(list);
  })
);

const employeeSchema = z.object({
  eid: z.string().min(1).max(64),
  site_key: siteKey,
  emp_id: z.string().max(64).optional(),
  name: z.string().min(1).max(200),
  position: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  kind: z.enum(['support', 'operation']).optional(),
  division: z.string().max(200).optional(),
  email: z.string().email().optional(),
});

// "employees writable by admins" — admin-only across ALL sites, which is
// stricter than the read policy on purpose: the roster decides where entries
// are allowed to land (enforce_entry_site), so a site manager editing it could
// silently redirect another site's history.
router.put(
  '/employees',
  requireRole('hr', 'admin'),
  asyncRoute(async (req, res) => {
    const e = employeeSchema.parse(req.body);
    const row = await one(
      `insert into hr.employees
         (eid, site_key, emp_id, name, position, department, kind, division, email)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (eid) do update set
         site_key = excluded.site_key, emp_id = excluded.emp_id, name = excluded.name,
         position = excluded.position, department = excluded.department,
         kind = excluded.kind, division = excluded.division, email = excluded.email
       returning *`,
      [
        e.eid,
        e.site_key,
        e.emp_id ?? null,
        e.name,
        e.position ?? null,
        e.department ?? null,
        e.kind ?? null,
        e.division ?? null,
        e.email ?? null,
      ]
    );
    res.json(row);
  })
);

/* ----------------------------- the monthly grid --------------------------- */

/**
 * One site's month: roster, every entry, and the per-day notes.
 *
 * Entries come back keyed eid → date → { team|detail, pm, note }, the shape the
 * grid renders. `team` vs `detail` is a DISPLAY split by employee kind, not a
 * storage one — both are slot 1. `pm` is slot 2 (งานเสริม) and is named for the
 * legacy column, not for an afternoon.
 */
router.get(
  '/month',
  requireHrSite((req) => req.query.site),
  asyncRoute(async (req, res) => {
    const q = monthQuery.parse(req.query);
    const { from, to } = monthRange(q.year, q.month);

    const [employees, entries, days, lock] = await Promise.all([
      rows(
        `select eid, emp_id, name, position, department, kind, division, email
           from hr.employees
          where site_key = $1
          order by (kind = 'operation') desc, name`,
        [q.site]
      ),
      rows(
        `select eid, entry_date, slot, value
           from hr.work_entries
          where site_key = $1 and entry_date >= $2 and entry_date < $3`,
        [q.site, from, to]
      ),
      rows(
        `select eid, entry_date, note, updated_at, updated_by
           from hr.work_days
          where site_key = $1 and entry_date >= $2 and entry_date < $3`,
        [q.site, from, to]
      ),
      one("select value from hr.config where key = 'LOCK_DAYS'"),
    ]);

    const kindOf = new Map(employees.map((e) => [e.eid, e.kind]));
    const grid = {};
    const cellAt = (eid, date) => {
      grid[eid] ??= {};
      grid[eid][date] ??= {};
      return grid[eid][date];
    };

    for (const r of entries) {
      const cell = cellAt(r.eid, ymd(r.entry_date));
      if (r.slot === 2) cell.pm = r.value ?? '';
      else if (kindOf.get(r.eid) === 'operation') cell.team = r.value ?? '';
      else cell.detail = r.value ?? '';
    }
    for (const d of days) {
      if (d.note) cellAt(d.eid, ymd(d.entry_date)).note = d.note;
    }

    res.json({
      ok: true,
      site: q.site,
      year: q.year,
      month: q.month,
      employees,
      entries: grid,
      lockDays: Number(lock?.value ?? 3),
    });
  })
);

const cellSchema = z.object({
  eid: z.string().min(1).max(64),
  date: isoDate,
  slot,
  value: z.string().max(200).nullable(),
});
const saveCellsSchema = z.object({
  site: siteKey,
  cells: z.array(cellSchema).max(500).default([]),
  notes: z
    .array(
      z.object({
        eid: z.string().min(1).max(64),
        date: isoDate,
        note: z.string().max(2000).nullable(),
      })
    )
    .max(500)
    .default([]),
});

/**
 * Save a batch of cells for one site.
 *
 * A batch rather than one call per cell because the grid saves a whole edited
 * row, and it runs in one transaction so a date the window trigger rejects does
 * not leave half a row written.
 *
 * An empty value DELETES the slot instead of storing ''. A blank cell means "no
 * entry"; a row holding '' would still be a row, and every count built on
 * work_entries would treat it as work that happened.
 */
router.post(
  '/cells',
  requireHrSite((req) => req.body?.site),
  asyncRoute(async (req, res) => {
    const body = saveCellsSchema.parse(req.body);
    const by = req.user.email;

    try {
      const written = await tx(req.user, async (c) => {
        let n = 0;
        for (const cell of body.cells) {
          const value = (cell.value ?? '').trim();
          if (value) {
            // The audit row comes from the work_entries_audit trigger, not from
            // here, so an edit made outside this API is audited too.
            await c.query(
              `insert into hr.work_entries (eid, site_key, entry_date, slot, value, updated_by)
               values ($1, $2, $3, $4, $5, $6)
               on conflict (eid, entry_date, slot) do update set
                 value = excluded.value, updated_by = excluded.updated_by`,
              [cell.eid, body.site, cell.date, cell.slot, value, by]
            );
          } else {
            await c.query(
              `delete from hr.work_entries
                where eid = $1 and site_key = $2 and entry_date = $3 and slot = $4`,
              [cell.eid, body.site, cell.date, cell.slot]
            );
          }
          n++;
        }

        for (const note of body.notes) {
          const text = (note.note ?? '').trim();
          if (text) {
            // The note belongs to the DAY, not to a slot: the sheet has one
            // note column per day shared by both slots, and storing it per slot
            // would let the two disagree about the same remark.
            await c.query(
              `insert into hr.work_days (eid, entry_date, site_key, note, updated_by)
               values ($1, $2, $3, $4, $5)
               on conflict (eid, entry_date) do update set
                 note = excluded.note, updated_by = excluded.updated_by`,
              [note.eid, note.date, body.site, text, by]
            );
          } else {
            await c.query(
              'delete from hr.work_days where eid = $1 and site_key = $2 and entry_date = $3',
              [note.eid, body.site, note.date]
            );
          }
        }
        return n;
      });
      res.json({ ok: true, written });
    } catch (err) {
      rethrowWindow(err);
    }
  })
);

/* --------------------------------- dashboard ------------------------------ */

/**
 * Per-site totals for a month.
 *
 * Mandays come from hr.mandays, which collapses both slots of a day into one
 * row. Do NOT switch this to count(*) over work_entries: that silently inflates
 * every site that logs งานเสริม, and no part of the UI would flag it.
 *
 * Admins get every site, everyone else only theirs, so one endpoint serves both.
 */
router.get(
  '/summary',
  asyncRoute(async (req, res) => {
    const q = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
        site: siteKey.optional(),
      })
      .parse(req.query);
    const { from, to } = monthRange(q.year, q.month);

    const scope = scopeFor(req, q.site);
    if (scope === false) return res.status(403).json({ error: 'FORBIDDEN_SITE', siteKey: q.site });

    const summary = await rows(
      `select s.site_key, s.name as site_name, s.company, s.active,
              (select count(*) from hr.employees e
                where e.site_key = s.site_key)::int as n_emp,
              (select count(*) from hr.employees e
                where e.site_key = s.site_key and e.kind = 'support')::int as n_support,
              (select count(*) from hr.employees e
                where e.site_key = s.site_key and e.kind = 'operation')::int as n_operation,
              (select count(*) from hr.mandays m
                where m.site_key = s.site_key
                  and m.entry_date >= $1 and m.entry_date < $2)::int as mandays
         from hr.sites s
        where $3::text[] is null or s.site_key = any($3::text[])
        order by s.name`,
      [from, to, scope]
    );

    // Per-day fill, again off the mandays view so a two-task day counts once.
    const daysFilled = await rows(
      `select site_key, entry_date, count(*)::int as filled
         from hr.mandays
        where entry_date >= $1 and entry_date < $2
          and ($3::text[] is null or site_key = any($3::text[]))
        group by site_key, entry_date
        order by entry_date`,
      [from, to, scope]
    );

    // The stored value is the composite "<code> / <cost>", so split it in SQL
    // rather than shipping every entry row to Node to be counted. These ARE
    // per-entry counts, not mandays — a day with two different activities
    // genuinely used both, and the totals here are activity mix, not workload.
    const topActivities = await rows(
      `select site_key, split_part(value, ' / ', 1) as name, count(*)::int as count
         from hr.work_entries
        where entry_date >= $1 and entry_date < $2
          and coalesce(value, '') <> ''
          and ($3::text[] is null or site_key = any($3::text[]))
        group by site_key, 2
        order by site_key, count desc`,
      [from, to, scope]
    );
    const topCostCodes = await rows(
      `select site_key, nullif(split_part(value, ' / ', 2), '') as name, count(*)::int as count
         from hr.work_entries
        where entry_date >= $1 and entry_date < $2
          and coalesce(value, '') <> ''
          and nullif(split_part(value, ' / ', 2), '') is not null
          and ($3::text[] is null or site_key = any($3::text[]))
        group by site_key, 2
        order by site_key, count desc`,
      [from, to, scope]
    );

    const groupBySite = (list, shape) =>
      list.reduce((acc, r) => {
        (acc[r.site_key] ??= []).push(shape(r));
        return acc;
      }, {});

    const fills = groupBySite(daysFilled, (r) => ({ date: ymd(r.entry_date), filled: r.filled }));
    const acts = groupBySite(topActivities, (r) => ({ name: r.name, count: r.count }));
    const costs = groupBySite(topCostCodes, (r) => ({ name: r.name, count: r.count }));

    res.json({
      ok: true,
      year: q.year,
      month: q.month,
      rows: summary.map((s) => ({
        ...s,
        daysFilled: fills[s.site_key] ?? [],
        topActivities: (acts[s.site_key] ?? []).slice(0, 10),
        topCostCodes: (costs[s.site_key] ?? []).slice(0, 10),
      })),
    });
  })
);

/** Mandays per employee over a range — the workload figure, never a row count. */
router.get(
  '/mandays',
  requireHrSite((req) => req.query.site),
  asyncRoute(async (req, res) => {
    const q = z
      .object({
        site: siteKey,
        from: isoDate,
        to: isoDate,
        eid: z.string().max(64).optional(),
      })
      .parse(req.query);

    const list = await rows(
      `select m.eid, e.name, count(*)::int as mandays
         from hr.mandays m
         left join hr.employees e on e.eid = m.eid
        where m.site_key = $1 and m.entry_date >= $2 and m.entry_date <= $3
          and ($4::text is null or m.eid = $4)
        group by m.eid, e.name
        order by e.name`,
      [q.site, q.from, q.to, q.eid ?? null]
    );
    res.json({ site: q.site, from: q.from, to: q.to, rows: list });
  })
);

/* ------------------------------ leave requests ---------------------------- */

const leaveType = z.enum(['sick', 'personal', 'vacation', 'maternity', 'ordination', 'other']);

/** The identity fields the printed leave slip needs. */
router.get(
  '/sites/:siteKey/roster',
  requireHrSite(),
  asyncRoute(async (req, res) => {
    const list = await rows(
      `select e.eid, e.name, e.kind, e.emp_id, e.position, e.department, s.company
         from hr.employees e
         left join hr.sites s on s.site_key = e.site_key
        where e.site_key = $1
        order by e.name`,
      [req.params.siteKey]
    );
    res.json(list);
  })
);

// "leave readable within site". One endpoint covers mine / pending / decided;
// the filters narrow, the scope is what decides what is visible at all.
router.get(
  '/leave',
  asyncRoute(async (req, res) => {
    const q = z
      .object({
        site: siteKey.optional(),
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
        eid: z.string().max(64).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
      })
      .parse(req.query);

    const scope = scopeFor(req, q.site);
    if (scope === false) return res.status(403).json({ error: 'FORBIDDEN_SITE', siteKey: q.site });

    const where = `where ($1::text[] is null or site_key = any($1::text[]))
                     and ($2::text is null or status = $2)
                     and ($3::text is null or eid = $3)`;
    const params = [scope, q.status ?? null, q.eid ?? null];

    const list = await rows(
      `select id, eid, site_key, emp_name, from_date, to_date, reason, status,
              requested_at, decided_by, decided_at, leave_type
         from hr.leave_requests
         ${where}
        order by requested_at desc
        limit $4`,
      [...params, q.limit]
    );
    // `total` may exceed rows.length: the list is capped but the count is not,
    // and the UI says "showing N of M".
    const total = await one(`select count(*)::int as n from hr.leave_requests ${where}`, params);

    res.json({
      rows: list.map((r) => ({ ...r, from_date: ymd(r.from_date), to_date: ymd(r.to_date) })),
      total: total?.n ?? list.length,
      shown: list.length,
    });
  })
);

const requestLeaveSchema = z.object({
  eid: z.string().min(1).max(64),
  from_date: isoDate,
  to_date: isoDate,
  reason: z.string().max(2000).optional(),
  leave_type: leaveType,
});

// "leave insertable within site". The form sends only an eid, exactly as the
// Apps Script version did, so the site and the name are resolved from the
// roster here — never taken from the body, or a caller could file a request
// against a site they cannot see.
router.post(
  '/leave',
  asyncRoute(async (req, res) => {
    const body = requestLeaveSchema.parse(req.body);
    if (body.to_date < body.from_date) return res.status(400).json({ error: 'BAD_RANGE' });

    const emp = await one('select eid, name, site_key from hr.employees where eid = $1', [body.eid]);
    if (!emp) return res.status(404).json({ error: 'NOT_FOUND' });

    const scope = scopeFor(req, emp.site_key);
    if (scope === false) return res.status(403).json({ error: 'FORBIDDEN_SITE', siteKey: emp.site_key });

    // Same id shape as the sheet ("LV" + timestamp + suffix). It is a text
    // primary key, and leave slips already printed carry it.
    const id = `LV${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${String(
      Math.floor(Math.random() * 1000)
    ).padStart(3, '0')}`;

    const row = await one(
      `insert into hr.leave_requests
         (id, eid, site_key, emp_name, from_date, to_date, reason, status, leave_type)
       values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
       returning *`,
      [
        id,
        emp.eid,
        emp.site_key,
        emp.name,
        body.from_date,
        body.to_date,
        body.reason ?? '',
        body.leave_type,
      ]
    );
    res.status(201).json({ ...row, from_date: ymd(row.from_date), to_date: ymd(row.to_date) });
  })
);

// "leave decidable by managers" — role in (admin, manager) AND within site.
router.post(
  '/leave/:id/decide',
  requireRole('hr', 'admin', 'manager'),
  asyncRoute(async (req, res) => {
    const { approve } = z.object({ approve: z.boolean() }).parse(req.body);

    const existing = await one('select id, site_key, status from hr.leave_requests where id = $1', [
      req.params.id,
    ]);
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

    const scope = scopeFor(req, existing.site_key);
    if (scope === false) {
      return res.status(403).json({ error: 'FORBIDDEN_SITE', siteKey: existing.site_key });
    }

    // The status re-check lives in the WHERE clause, not only in the read
    // above: two managers clicking at once must not both write a decision.
    const row = await one(
      `update hr.leave_requests
          set status = $2, decided_by = $3, decided_at = now()
        where id = $1 and status = 'pending'
        returning *`,
      [req.params.id, approve ? 'approved' : 'rejected', req.user.email]
    );
    if (!row) return res.status(409).json({ error: 'ALREADY_DECIDED' });
    res.json({ ...row, from_date: ymd(row.from_date), to_date: ymd(row.to_date) });
  })
);

// Cancel is the requester's own escape hatch and exists only while pending —
// once decided the row is a record, not a draft. Admins may cancel for anyone;
// everyone else only their own eid.
router.delete(
  '/leave/:id',
  asyncRoute(async (req, res) => {
    const { eid } = z.object({ eid: z.string().min(1).max(64) }).parse(req.query);

    const row = await one('select id, eid, site_key, status from hr.leave_requests where id = $1', [
      req.params.id,
    ]);
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    if (row.status !== 'pending') return res.status(409).json({ error: 'ALREADY_DECIDED' });
    if (!isAdmin(req) && row.eid !== eid) return res.status(403).json({ error: 'FORBIDDEN' });

    // Bind the delete to the status as well, so a decision landing between the
    // read and the write is not thrown away.
    const gone = await one(
      "delete from hr.leave_requests where id = $1 and status = 'pending' returning id",
      [req.params.id]
    );
    if (!gone) return res.status(409).json({ error: 'ALREADY_DECIDED' });
    res.json({ ok: true });
  })
);

/* --------------------------- migrations and audit ------------------------- */

const migrationSchema = z.object({
  eid: z.string().min(1).max(64),
  to_site: siteKey,
  move_date: isoDate,
});

// "migrations readable/insertable by admins" — an employee moving between
// sites. Recording the move and updating the roster must be ONE transaction:
// half of it leaves enforce_entry_site rejecting every subsequent write for
// that person, with no obvious cause.
router.post(
  '/migrations',
  requireRole('hr', 'admin'),
  asyncRoute(async (req, res) => {
    const m = migrationSchema.parse(req.body);
    const row = await tx(req.user, async (c) => {
      const emp = await c.query('select eid, site_key from hr.employees where eid = $1', [m.eid]);
      if (!emp.rows[0]) {
        const e = new Error('Employee not found');
        e.status = 404;
        e.code = 'NOT_FOUND';
        throw e;
      }
      const ins = await c.query(
        `insert into hr.migrations (eid, from_site, to_site, move_date, moved_by)
         values ($1, $2, $3, $4, $5) returning *`,
        [m.eid, emp.rows[0].site_key, m.to_site, m.move_date, req.user.email]
      );
      await c.query('update hr.employees set site_key = $2 where eid = $1', [m.eid, m.to_site]);
      return ins.rows[0];
    });
    res.status(201).json(row);
  })
);

router.get(
  '/migrations',
  requireRole('hr', 'admin'),
  asyncRoute(async (_req, res) => {
    const list = await rows(
      `select id, eid, from_site, to_site, move_date, moved_by, at
         from hr.migrations
        order by at desc
        limit 500`
    );
    res.json(list);
  })
);

// "hr audit readable by admins". Rows are appended by the work_entries trigger,
// so there is deliberately no POST — an endpoint that let a client write the
// audit log would make it worthless as evidence.
router.get(
  '/audit',
  requireRole('hr', 'admin'),
  asyncRoute(async (req, res) => {
    const q = z
      .object({
        site: siteKey.optional(),
        eid: z.string().max(64).optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(200),
      })
      .parse(req.query);

    const list = await rows(
      `select id, at, email, site, year, month, eid, emp_name, day, field, old_val, new_val
         from hr.audit_log
        where ($1::text is null or site = $1)
          and ($2::text is null or eid = $2)
        order by at desc
        limit $3`,
      [q.site ?? null, q.eid ?? null, q.limit]
    );
    res.json(list);
  })
);

// There is no bulk historical import endpoint here, deliberately. The Apps
// Script version has one that times out part-way through a large sheet and is
// not resumable, so a retry double-writes some months and skips others.
// Historical data is loaded by the one-off migration script instead, where a
// failure can be inspected and restarted. Do not add one back.

export default router;
