import { Document, Project } from '../models/index.js';
import { putObject, deleteObject, getObjectBuffer } from '../config/storage.js';
import { generateLetterPdf } from './letterhead.js';

/**
 * Load a document + its project letterhead config (embedded in the project).
 * Returns { doc, letter } where letter is the embedded letterhead (or {}).
 */
async function loadDocAndLetter(documentId) {
  const doc = await Document.findById(documentId);
  if (!doc) throw new Error('Document not found');
  const project = await Project.findById(doc.projectId).lean();
  return { doc, letter: project?.letterhead || {} };
}

/** Remove any existing generated attachment of a given version for a doc. */
async function clearVersion(doc, version) {
  const stale = doc.attachments.filter(
    (a) => a.kind === 'generated_pdf' && a.version === version
  );
  for (const a of stale) {
    await deleteObject(a.storageKey).catch(() => {});
  }
  if (stale.length) {
    await Document.updateOne(
      { _id: doc._id },
      { $pull: { attachments: { kind: 'generated_pdf', version } } }
    );
  }
}

/** Push a generated-PDF attachment subdoc and return it (with its _id). */
async function recordGeneratedPdf(doc, { version, fileName, sizeBytes, storageKey, uploadedBy }) {
  const updated = await Document.findByIdAndUpdate(
    doc._id,
    {
      $push: {
        attachments: {
          kind: 'generated_pdf',
          version,
          fileName,
          contentType: 'application/pdf',
          sizeBytes,
          storageKey,
          uploadedBy: uploadedBy || null,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );
  const att = updated.attachments[updated.attachments.length - 1];
  return {
    id: String(att._id),
    storage_key: att.storageKey,
    file_name: att.fileName,
    created_at: att.createdAt,
  };
}

/**
 * Generate the ORIGINAL letter PDF (no approver signatures) from the letterhead,
 * store it in GridFS, and record it as a generated, version='original' attachment.
 * Returns { id, storage_key, file_name, created_at }.
 */
export async function generateOriginalPdf(documentId, uploadedBy = null) {
  const { doc, letter } = await loadDocAndLetter(documentId);
  const pdf = await generateLetterPdf(docView(doc), letter);
  const key = `documents/${doc._id}/original-${doc.runNo}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc, 'original');

  return recordGeneratedPdf(doc, {
    version: 'original',
    fileName: `${doc.docNumber.replace(/\//g, '-')}.pdf`,
    sizeBytes: pdf.length,
    storageKey: key,
    uploadedBy,
  });
}

/**
 * Generate the APPROVED letter PDF — the same letter, but with each approver's
 * signature image stamped in the signature block. Pulls signatures from the
 * embedded approvalSteps (signatureUrl in GridFS). Stores version='approved'.
 */
export async function generateApprovedPdf(documentId, uploadedBy = null) {
  const { doc, letter } = await loadDocAndLetter(documentId);

  const approvedSteps = doc.approvalSteps
    .filter((s) => s.action === 'approved')
    .sort((a, b) => a.stepNo - b.stepNo);

  const signatures = [];
  for (const s of approvedSteps) {
    let image = null;
    if (s.signatureUrl) {
      try { image = await getObjectBuffer(s.signatureUrl); } catch { image = null; }
    }
    signatures.push({ image, name: s.approverName, title: letter.signatoryTitle || '' });
  }

  const pdf = await generateLetterPdf(docView(doc), letter, { signatures });
  const key = `documents/${doc._id}/approved-${doc.runNo}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc, 'approved');

  return recordGeneratedPdf(doc, {
    version: 'approved',
    fileName: `${doc.docNumber.replace(/\//g, '-')}-approved.pdf`,
    sizeBytes: pdf.length,
    storageKey: key,
    uploadedBy,
  });
}

/** Map a Mongoose doc to the field names letterhead.js reads. */
function docView(doc) {
  return {
    doc_number: doc.docNumber,
    subject: doc.subject,
    recipient: doc.recipient,
    body: doc.body,
    date_received: doc.dateReceived,
    work_unit: doc.workUnit,
    enclosures: doc.enclosures || [],
  };
}
