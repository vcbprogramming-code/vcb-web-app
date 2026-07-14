import { Router } from 'express';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

/** GET /api/projects — list projects (the register chips). */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select p.id, p.code, p.name, p.doc_prefix, p.color, p.is_active,
              lh.manager_email, lh.signatory_name as manager_name
         from projects p
         left join project_letterhead lh on lh.project_id = p.id
        where p.is_active = true
        order by p.sort_order, p.code`
    );
    res.json({ data: rows });
  })
);

/** GET /api/projects/doc-codes — the doc-code → department mapping. */
router.get(
  '/doc-codes',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select code, department, recipient_title, default_approvers from doc_code_departments order by code`
    );
    res.json({ data: rows });
  })
);

/** GET /api/projects/document-types — document type options. */
router.get(
  '/document-types',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select id, name from document_types order by sort_order, name`
    );
    res.json({ data: rows });
  })
);

/**
 * GET /api/projects/:id/letterhead — READ-ONLY letterhead config for the create
 * form (signatory/manager/company). Any authenticated user may read it; editing
 * stays admin-only (PUT /api/admin/projects/:id/letterhead). This is the non-admin
 * counterpart to the admin GET so clerks see the project manager / signer too.
 * Same response shape as the admin endpoint. Placed after the literal routes so
 * '/doc-codes' and '/document-types' still match first.
 */
router.get(
  '/:id/letterhead',
  asyncHandler(async (req, res) => {
    const row = await queryOne('select * from project_letterhead where project_id = $1', [req.params.id]);
    res.json({ data: row || null });
  })
);

export default router;
