import { Router } from 'express';
import { query, queryOne } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// PUBLIC document-authenticity check (#6). Reached by scanning the QR code on a
// printed/exported copy, so NO requireAuth. Security = the unguessable token.
// Returns read-only proof (status + approval trail + audit log). No file bytes,
// no editing — just enough to confirm "this is a real document from our system".
const router = Router();

/** GET /api/verify/:token — public authenticity view for one document. */
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    // guard against non-uuid tokens (avoids a DB cast error → 500)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      throw new ApiError(404, 'ไม่พบเอกสาร');
    }
    const doc = await queryOne(
      `select d.id, d.doc_number, d.subject, d.status, d.date_received, d.department,
              d.created_at, p.code as project_code, p.name as project_name,
              t.name as doc_type_name, c.name as company_name
         from documents d
         join projects p on p.id = d.project_id
         left join document_types t on t.id = d.doc_type_id
         left join companies c on c.id = d.company_id
        where d.verify_token = $1`,
      [token]
    );
    if (!doc) throw new ApiError(404, 'ไม่พบเอกสาร — QR/ลิงก์อาจไม่ถูกต้อง');

    const { rows: steps } = await query(
      `select step_no, approver_name, approver_email, action, comment, acted_at
         from approval_steps where document_id = $1 order by step_no`,
      [doc.id]
    );
    const { rows: audit } = await query(
      `select action, actor_label, created_at
         from audit_log where document_id = $1 order by created_at`,
      [doc.id]
    );
    res.json({ data: { document: doc, approval_steps: steps, audit } });
  })
);

export default router;
