import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import multer from 'multer';
import { Document, Project } from '../models/index.js';
import { docListItem, docDetail, attachmentOut } from '../utils/serialize.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import {
  departmentForDocCode,
  allocateDocNumber,
  formatDocNumber,
  peekNextRunNo,
} from '../services/docNumber.js';
import { putObject, deleteObject, openDownloadStream } from '../config/storage.js';
import { generateOriginalPdf } from '../services/pdfDoc.js';
import { createApprovalChain, sendApprovalRequest } from '../services/approval.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes },
});

/**
 * GET /api/documents
 * Filters: ?projectId= &status= &docTypeId= &from= &to= &search= &page= &pageSize=
 * Returns { data, total, page, pageSize }.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, status, docTypeId, from, to, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    if (docTypeId) filter.docTypeId = docTypeId;
    if (from || to) {
      filter.dateReceived = {};
      if (from) filter.dateReceived.$gte = new Date(from);
      if (to) filter.dateReceived.$lte = new Date(to);
    }
    if (search) {
      const rx = new RegExp(escapeRegExp(String(search)), 'i');
      filter.$or = [{ subject: rx }, { docNumber: rx }, { recipient: rx }, { remarks: rx }];
    }

    const total = await Document.countDocuments(filter);
    const rows = await Document.find(filter)
      .sort({ dateReceived: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('projectId', 'code color')
      .populate('docTypeId', 'name')
      .lean();

    res.json({ data: rows.map(docListItem), total, page, pageSize });
  })
);

/**
 * GET /api/documents/next-number?projectId=&docCode=
 * Preview the doc number that a new document WOULD get (not reserved yet).
 */
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const { projectId, docCode } = req.query;
    if (!projectId || !docCode) {
      throw new ApiError(400, 'projectId and docCode are required');
    }
    const project = await Project.findById(projectId).lean();
    if (!project) throw new ApiError(404, 'Project not found');

    const department = await departmentForDocCode(docCode);
    const runNo = await peekNextRunNo(projectId);
    const docNumber = formatDocNumber({
      prefix: project.docPrefix,
      department,
      docCode,
      runNo,
    });
    res.json({ data: { runNo, department, docNumber } });
  })
);

/**
 * GET /api/documents/stats — summary for the E-Memo dashboard:
 * totals, breakdown by status, by project, recent docs, and pending docs.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // run all 6 reads concurrently instead of one-after-another
    const [byStatusAgg, projects, perProject, recentRows, pendingRows, thisMonth] = await Promise.all([
      Document.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Project.find().sort({ sortOrder: 1 }).lean(),
      Document.aggregate([{ $group: { _id: '$projectId', count: { $sum: 1 } } }]),
      Document.find().sort({ createdAt: -1 }).limit(5).populate('projectId', 'code color').lean(),
      Document.find({ status: 'pending' }).sort({ dateReceived: 1 }).limit(5).populate('projectId', 'code color').lean(),
      Document.countDocuments({ dateReceived: { $gte: monthStart, $lt: nextMonth } }),
    ]);

    const statusMap = Object.fromEntries(byStatusAgg.map((r) => [r._id, r.count]));
    const total = byStatusAgg.reduce((s, r) => s + r.count, 0);

    const countByProject = Object.fromEntries(perProject.map((r) => [String(r._id), r.count]));
    const byProject = projects
      .map((p) => ({ code: p.code, color: p.color ?? null, count: countByProject[String(p._id)] || 0 }))
      .sort((a, b) => b.count - a.count);

    const recent = recentRows.map((d) => ({
      id: String(d._id),
      doc_number: d.docNumber,
      subject: d.subject,
      status: d.status,
      date_received: d.dateReceived,
      project_code: d.projectId?.code ?? null,
      project_color: d.projectId?.color ?? null,
    }));

    const pending = pendingRows.map((d) => ({
      id: String(d._id),
      doc_number: d.docNumber,
      subject: d.subject,
      date_received: d.dateReceived,
      project_code: d.projectId?.code ?? null,
      project_color: d.projectId?.color ?? null,
    }));

    res.json({
      data: { total, thisMonth, byStatus: statusMap, byProject, recent, pending },
    });
  })
);

/** GET /api/documents/:id — full document detail (incl. attachments + steps). */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Document.findById(req.params.id)
      .populate('projectId', 'code color')
      .populate('docTypeId', 'name')
      .lean();
    if (!doc) throw new ApiError(404, 'Document not found');
    res.json({ data: docDetail(doc) });
  })
);

const createSchema = z.object({
  projectId: z.string().min(1),
  docCode: z.string().min(1).max(10),
  subject: z.string().min(1),
  recipient: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  docTypeId: z.string().optional().nullable(),
  dateReceived: z.string().optional(), // ISO date; defaults to today
  workUnit: z.string().optional(), // ชื่อหน่วยงาน e.g. "บางเตย"
  enclosures: z
    .array(z.object({ name: z.string(), qty: z.number().optional(), unit: z.string().optional() }))
    .optional(),
});

/**
 * POST /api/documents
 * Creates a document, allocating the next per-project run number atomically
 * via the counter ($inc). The document + first audit entry are one write.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid input', parsed.error.flatten());
    }
    const input = parsed.data;

    const project = await Project.findById(input.projectId).lean();
    if (!project) throw new ApiError(404, 'Project not found');

    const { runNo, docNumber, department } = await allocateDocNumber({
      project,
      docCode: input.docCode,
    });

    const created = await Document.create({
      projectId: project._id,
      docCode: input.docCode,
      department,
      runNo,
      docNumber,
      docTypeId: input.docTypeId || null,
      subject: input.subject,
      recipient: input.recipient || null,
      body: input.body || null,
      remarks: input.remarks || null,
      dateReceived: input.dateReceived ? new Date(input.dateReceived) : new Date(),
      workUnit: input.workUnit || null,
      enclosures: input.enclosures || [],
      source: 'manual',
      status: 'pending',
      createdBy: req.profile.id,
      audit: [
        {
          actorId: req.profile.id,
          actorLabel: req.profile.full_name || req.profile.email,
          action: 'created',
          detail: { doc_number: docNumber },
          createdAt: new Date(),
        },
      ],
    });

    res.status(201).json({
      data: {
        id: String(created._id),
        doc_number: created.docNumber,
        run_no: created.runNo,
        department: created.department,
        status: created.status,
        date_received: created.dateReceived,
      },
    });
  })
);

// ===========================================================================
// Attachments (GridFS)
// ===========================================================================

/** Ensure a document exists or 404. Returns the Mongoose doc. */
async function getDocOr404(id) {
  const doc = await Document.findById(id);
  if (!doc) throw new ApiError(404, 'Document not found');
  return doc;
}

/**
 * POST /api/documents/:id/attachments
 * Multipart upload (field `file`). Streams the file into GridFS and records an
 * embedded attachment subdoc. Replaces the old presigned-PUT + confirm dance.
 */
router.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    if (!req.file) throw new ApiError(400, 'No file uploaded (field "file")');

    const safeName = req.file.originalname.replace(/[^\w.\-ก-๙ ]/g, '_');
    const key = `documents/${req.params.id}/${crypto.randomUUID()}-${safeName}`;
    await putObject(key, req.file.buffer, req.file.mimetype);

    const updated = await Document.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          attachments: {
            kind: 'upload',
            fileName: req.file.originalname,
            contentType: req.file.mimetype || null,
            sizeBytes: req.file.size ?? null,
            storageKey: key,
            uploadedBy: req.profile.id,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
    const att = updated.attachments[updated.attachments.length - 1];
    res.status(201).json({ data: attachmentOut(att) });
  })
);

/**
 * GET /api/documents/:id/attachments/:attId/download
 * Streams the file bytes from GridFS (inline, so the browser can preview PDFs
 * and images). Replaces the old presigned-GET url.
 */
router.get(
  '/:id/attachments/:attId/download',
  asyncHandler(async (req, res) => {
    const doc = await Document.findById(req.params.id).lean();
    if (!doc) throw new ApiError(404, 'Document not found');
    const att = (doc.attachments || []).find((a) => String(a._id) === req.params.attId);
    if (!att) throw new ApiError(404, 'Attachment not found');

    const obj = await openDownloadStream(att.storageKey);
    if (!obj) throw new ApiError(404, 'File not found in storage');

    res.setHeader('Content-Type', obj.contentType || att.contentType || 'application/octet-stream');
    if (obj.length != null) res.setHeader('Content-Length', obj.length);
    const encoded = encodeURIComponent(att.fileName || 'file');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encoded}`);
    obj.stream.on('error', () => res.destroy());
    obj.stream.pipe(res);
  })
);

/** DELETE /api/documents/:id/attachments/:attId */
router.delete(
  '/:id/attachments/:attId',
  asyncHandler(async (req, res) => {
    const doc = await Document.findById(req.params.id).lean();
    if (!doc) throw new ApiError(404, 'Document not found');
    const att = (doc.attachments || []).find((a) => String(a._id) === req.params.attId);
    if (!att) throw new ApiError(404, 'Attachment not found');

    await deleteObject(att.storageKey).catch(() => {});
    await Document.updateOne(
      { _id: req.params.id },
      { $pull: { attachments: { _id: att._id } } }
    );
    res.json({ data: { deleted: true } });
  })
);

// ===========================================================================
// Letterhead PDF generation
// ===========================================================================

/**
 * POST /api/documents/:id/generate-pdf
 * Builds the official A4 letter from the doc + project letterhead config,
 * stores it in GridFS, and records it as a 'generated_pdf' attachment.
 * Returns the attachment metadata; open it via the /download endpoint.
 */
router.post(
  '/:id/generate-pdf',
  asyncHandler(async (req, res) => {
    await getDocOr404(req.params.id);
    const row = await generateOriginalPdf(req.params.id, req.profile.id);
    res.status(201).json({
      data: { id: row.id, file_name: row.file_name, version: 'original', created_at: row.created_at },
    });
  })
);

// ===========================================================================
// Submit for approval (build the chain + email step 1)
// ===========================================================================

const submitSchema = z.object({
  approvers: z
    .array(z.object({ name: z.string().optional(), email: z.string().email() }))
    .min(1),
});

/**
 * POST /api/documents/:id/submit
 * Creates the sequential approval chain and emails the first approver a
 * tokenised link. Sets the document to 'pending'.
 */
router.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const doc = await getDocOr404(req.params.id);
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'Invalid input', parsed.error.flatten());

    const firstStep = await createApprovalChain({
      documentId: doc._id,
      approvers: parsed.data.approvers,
      actorLabel: req.profile.full_name || req.profile.email,
      actorId: req.profile.id,
    });

    // email outside the write
    await sendApprovalRequest({
      step: firstStep,
      doc: { doc_number: doc.docNumber, subject: doc.subject },
    }).catch((e) => console.error('approval email failed:', e.message));

    res.json({ data: { status: 'pending', firstApprover: firstStep.approver_email } });
  })
);

/** Escape a user string for safe use inside a RegExp. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default router;
