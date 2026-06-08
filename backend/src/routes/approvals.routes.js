import { Router } from 'express';
import { z } from 'zod';
import { pool, queryOne } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import crypto from 'node:crypto';
import { applyApprovalAction, sendApprovalRequest } from '../services/approval.js';
import { putObject } from '../config/storage.js';
import { generateApprovedPdf } from '../services/pdfDoc.js';

// PUBLIC routes — reached from email links, so NO requireAuth.
// Security comes from the unguessable one-time token, not a login session.
const router = Router();

/**
 * GET /api/approvals/:token — look up what a token refers to, so the public
 * approval page can show the document before the approver decides.
 */
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const step = await queryOne(
      `select s.id, s.step_no, s.approver_name, s.approver_email, s.action,
              s.token_expires_at, d.doc_number, d.subject, d.recipient, d.status
         from approval_steps s join documents d on d.id = s.document_id
        where s.action_token = $1`,
      [req.params.token]
    );
    if (!step) throw new ApiError(404, 'ไม่พบรายการอนุมัติ หรือลิงก์ถูกใช้ไปแล้ว');
    const expired = step.token_expires_at && new Date(step.token_expires_at) < new Date();
    res.json({ data: { ...step, expired } });
  })
);

const actionSchema = z.object({
  action: z.enum(['approved', 'rejected', 'returned']),
  comment: z.string().optional(),
  // optional signature drawn on the approval page, as a data URL (PNG)
  signatureDataUrl: z.string().optional(),
});

/** Store a base64 data-URL signature image to S3, return its key (or null). */
async function storeSignatureDataUrl(token, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  const [, contentType, b64] = m;
  const ext = contentType.split('/')[1] || 'png';
  const key = `signatures/${token}-${crypto.randomUUID()}.${ext}`;
  await putObject(key, Buffer.from(b64, 'base64'), contentType);
  return key;
}

/**
 * POST /api/approvals/:token — perform the approval action from the email link.
 * Advances the chain (emailing the next approver) or finalises the document.
 */
router.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    // upload the drawn signature first (if any) so we can attach its key
    const signatureUrl = await storeSignatureDataUrl(req.params.token, parsed.data.signatureDataUrl);

    const client = await pool.connect();
    let result;
    try {
      await client.query('begin');
      result = await applyApprovalAction(client, {
        token: req.params.token,
        action: parsed.data.action,
        comment: parsed.data.comment,
        signatureUrl,
      });
      if (result.error) {
        await client.query('rollback');
        const msg = {
          invalid_token: 'ไม่พบรายการอนุมัติ',
          already_actioned: 'รายการนี้ถูกดำเนินการไปแล้ว',
          expired: 'ลิงก์หมดอายุแล้ว',
        }[result.error] || 'ไม่สามารถดำเนินการได้';
        throw new ApiError(409, msg);
      }
      await client.query('commit');
    } catch (err) {
      if (!(err instanceof ApiError)) await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // If the chain advanced, email the next approver (outside the txn).
    if (result.nextStep) {
      await sendApprovalRequest({ step: result.nextStep, doc: result.document }).catch((e) =>
        console.error('next-approver email failed:', e.message)
      );
    }

    // When the whole chain is approved, generate the signed APPROVED PDF.
    if (result.finalized) {
      await generateApprovedPdf(result.document.id).catch((e) =>
        console.error('approved-pdf generation failed:', e.message)
      );
    }

    res.json({
      data: {
        action: parsed.data.action,
        documentStatus: result.document.status,
        advanced: Boolean(result.nextStep),
        finalized: Boolean(result.finalized),
      },
    });
  })
);

export default router;
