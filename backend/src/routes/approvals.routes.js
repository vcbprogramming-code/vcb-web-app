import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import crypto from 'node:crypto';
import { applyApprovalAction, forwardApprovalStep, sendApprovalRequest } from '../services/approval.js';
import { sendAuthorNotification } from '../services/email.js';
import { putObject, openDownloadStream } from '../config/storage.js';
import { generateApprovedPdf, regenerateOriginalWithAudit } from '../services/pdfDoc.js';
import { autoCombine } from '../services/pdfMerge.js';

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
              s.token_expires_at, s.document_id,
              d.doc_number, d.subject, d.recipient, d.body, d.remarks,
              d.department, d.work_unit, d.date_received, d.enclosures, d.status,
              p.code as project_code, p.name as project_name,
              t.name as doc_type_name
         from approval_steps s
         join documents d on d.id = s.document_id
         join projects p on p.id = d.project_id
         left join document_types t on t.id = d.doc_type_id
        where s.action_token = $1`,
      [req.params.token]
    );
    if (!step) throw new ApiError(404, 'ไม่พบรายการอนุมัติ หรือลิงก์ถูกใช้ไปแล้ว');
    const expired = step.token_expires_at && new Date(step.token_expires_at) < new Date();

    // attachments (incl. the generated original PDF) so the approver can review
    const { rows: attachments } = await query(
      `select id, kind, version, file_name, content_type, size_bytes, created_at
         from document_attachments where document_id = $1 order by created_at`,
      [step.document_id]
    );
    // prior steps' decisions for context
    const { rows: steps } = await query(
      `select step_no, approver_name, approver_email, action, comment, acted_at
         from approval_steps where document_id = $1 order by step_no`,
      [step.document_id]
    );
    res.json({ data: { ...step, expired, attachments, approval_steps: steps } });
  })
);

/**
 * GET /api/approvals/:token/attachments/:attId/download — public (token-gated)
 * attachment stream, so the approver can open files/PDFs without logging in.
 */
router.get(
  '/:token/attachments/:attId/download',
  asyncHandler(async (req, res) => {
    // the token must belong to the same document as the attachment
    const ok = await queryOne(
      `select a.storage_key, a.file_name, a.content_type
         from document_attachments a
         join approval_steps s on s.document_id = a.document_id
        where s.action_token = $1 and a.id = $2`,
      [req.params.token, req.params.attId]
    );
    if (!ok) throw new ApiError(404, 'ไม่พบไฟล์');
    const obj = await openDownloadStream(ok.storage_key);
    if (!obj) throw new ApiError(404, 'ไม่พบไฟล์ในที่จัดเก็บ');
    res.setHeader('Content-Type', obj.contentType || ok.content_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(ok.file_name || 'file')}`);
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
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
    // reject/return must carry a reason (backs up the client-side rule for direct
    // API calls, so the audit/verify trail is never left blank)
    if ((parsed.data.action === 'rejected' || parsed.data.action === 'returned') && !parsed.data.comment?.trim()) {
      throw new ApiError(400, 'กรุณาระบุเหตุผลสำหรับการไม่อนุมัติหรือส่งกลับแก้ไข');
    }

    // reject unknown tokens BEFORE writing anything to storage (avoid abuse)
    const validStep = await queryOne(
      `select id from approval_steps where action_token = $1 and action = 'pending'`,
      [req.params.token]
    );
    if (!validStep) throw new ApiError(404, 'ไม่พบรายการอนุมัติ หรือลิงก์ถูกใช้ไปแล้ว');

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
      await autoCombine(result.document.id); // merge the SIGNED letter into the combined file
    } else if (parsed.data.action === 'returned' || parsed.data.action === 'rejected') {
      // append the decision/reason to the document's PDF
      await regenerateOriginalWithAudit(result.document.id).catch((e) =>
        console.error('audit-pdf regeneration failed:', e.message)
      );
      await autoCombine(result.document.id);
    }

    // notify the document author of a terminal outcome (approved / returned / rejected)
    if (result.finalized || parsed.data.action === 'returned' || parsed.data.action === 'rejected') {
      const author = await queryOne(
        `select pr.full_name, pr.email from documents d
           join profiles pr on pr.id = d.created_by where d.id = $1`,
        [result.document.id]
      ).catch(() => null);
      if (author?.email) {
        await sendAuthorNotification({
          toEmail: author.email,
          authorName: author.full_name,
          doc: result.document,
          outcome: result.finalized ? 'approved' : parsed.data.action,
          actorName: result.step?.approver_name || result.step?.approver_email,
          comment: parsed.data.comment,
        }).catch((e) => console.error('author notification failed:', e.message));
      }
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

const forwardSchema = z.object({
  toEmail: z.string().email(),
  toName: z.string().optional(),
  comment: z.string().optional(),
});

/**
 * POST /api/approvals/:token/forward — delegate the current step to someone else.
 * Re-points this step at a new approver and emails them a fresh link.
 */
router.post(
  '/:token/forward',
  asyncHandler(async (req, res) => {
    const parsed = forwardSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    const client = await pool.connect();
    let result;
    try {
      await client.query('begin');
      result = await forwardApprovalStep(client, {
        token: req.params.token,
        toEmail: parsed.data.toEmail.trim(),
        toName: parsed.data.toName?.trim(),
        comment: parsed.data.comment,
      });
      if (result.error) {
        await client.query('rollback');
        const msg = {
          invalid_token: 'ไม่พบรายการอนุมัติ',
          already_actioned: 'รายการนี้ถูกดำเนินการไปแล้ว',
          expired: 'ลิงก์หมดอายุแล้ว',
          no_account: 'ผู้รับมอบต้องมีบัญชีในระบบก่อน จึงจะส่งต่อให้อนุมัติได้',
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

    await sendApprovalRequest({ step: result.step, doc: result.document }).catch((e) =>
      console.error('forwarded-approver email failed:', e.message)
    );

    res.json({ data: { forwarded: true, to: result.step.approver_email } });
  })
);

export default router;
