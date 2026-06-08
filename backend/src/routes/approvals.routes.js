import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { Document } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
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
    const doc = await Document.findOne({ 'approvalSteps.actionToken': req.params.token }).lean();
    if (!doc) throw new ApiError(404, 'ไม่พบรายการอนุมัติ หรือลิงก์ถูกใช้ไปแล้ว');
    const step = doc.approvalSteps.find((s) => s.actionToken === req.params.token);
    if (!step) throw new ApiError(404, 'ไม่พบรายการอนุมัติ หรือลิงก์ถูกใช้ไปแล้ว');

    const expired = step.tokenExpiresAt && new Date(step.tokenExpiresAt) < new Date();
    res.json({
      data: {
        id: String(step._id),
        step_no: step.stepNo,
        approver_name: step.approverName ?? null,
        approver_email: step.approverEmail,
        action: step.action,
        token_expires_at: step.tokenExpiresAt ?? null,
        doc_number: doc.docNumber,
        subject: doc.subject,
        recipient: doc.recipient ?? null,
        status: doc.status,
        expired,
      },
    });
  })
);

const actionSchema = z.object({
  action: z.enum(['approved', 'rejected', 'returned']),
  comment: z.string().optional(),
  // optional signature drawn on the approval page, as a data URL (PNG)
  signatureDataUrl: z.string().optional(),
});

/** Store a base64 data-URL signature image to GridFS, return its key (or null). */
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

    const result = await applyApprovalAction({
      token: req.params.token,
      action: parsed.data.action,
      comment: parsed.data.comment,
      signatureUrl,
    });

    if (result.error) {
      const msg =
        {
          invalid_token: 'ไม่พบรายการอนุมัติ',
          already_actioned: 'รายการนี้ถูกดำเนินการไปแล้ว',
          expired: 'ลิงก์หมดอายุแล้ว',
        }[result.error] || 'ไม่สามารถดำเนินการได้';
      throw new ApiError(409, msg);
    }

    // If the chain advanced, email the next approver.
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
