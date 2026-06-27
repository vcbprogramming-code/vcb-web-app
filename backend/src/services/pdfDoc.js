import { query, queryOne } from '../config/db.js';
import { putObject, deleteObject, getObjectBuffer } from '../config/storage.js';
import { generateLetterPdf } from './letterhead.js';

/** Load a document row (+ author name) + its project letterhead config. */
async function loadDocAndLetter(documentId) {
  const doc = await queryOne(
    `select d.*, pr.full_name as author_name, pr.job_title as author_title,
            pr.signature_url as author_profile_signature
       from documents d
       left join profiles pr on pr.id = d.created_by
      where d.id = $1`,
    [documentId]
  );
  if (!doc) throw new Error('Document not found');
  const letter = await queryOne(
    'select * from project_letterhead where project_id = $1',
    [doc.project_id]
  );
  return { doc, letter: letter || {} };
}

/** Remove any existing generated attachment of a given version for a doc. */
async function clearVersion(documentId, version) {
  const old = await query(
    `select id, storage_key from document_attachments
      where document_id = $1 and version = $2 and kind = 'generated_pdf'`,
    [documentId, version]
  );
  for (const o of old.rows) {
    await deleteObject(o.storage_key).catch(() => {});
    await query('delete from document_attachments where id = $1', [o.id]);
  }
}

/**
 * Generate the ORIGINAL letter PDF (no approver signatures) from the letterhead,
 * store it on S3, and record it as a generated, version='original' attachment.
 * Returns { id, storage_key, file_name }.
 */
export async function generateOriginalPdf(documentId, uploadedBy = null) {
  const { doc, letter } = await loadDocAndLetter(documentId);
  // signature image: the one chosen for this doc, else the author's saved
  // profile signature
  const sigKey = doc.author_signature_url || doc.author_profile_signature;
  let authorSignature = null;
  if (sigKey) {
    authorSignature = await getObjectBuffer(sigKey).catch(() => null);
  }
  // the author's job title shown under their name
  const pdf = await generateLetterPdf(doc, letter, { authorSignature, authorTitle: doc.author_title });
  const key = `documents/${doc.id}/original-${doc.run_no}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc.id, 'original');

  return queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'generated_pdf','original',$2,'application/pdf',$3,$4,$5)
     returning id, storage_key, file_name, created_at`,
    [doc.id, `${doc.doc_number.replace(/\//g, '-')}.pdf`, pdf.length, key, uploadedBy]
  );
}

/**
 * Generate the APPROVED letter PDF — the same letter, but with each approver's
 * signature image stamped in the signature block. Pulls signatures from the
 * approval_steps (signature_url in S3). Stores version='approved'.
 */
export async function generateApprovedPdf(documentId, uploadedBy = null) {
  const { doc, letter } = await loadDocAndLetter(documentId);

  const { rows: steps } = await query(
    `select approver_name, signature_url
       from approval_steps
      where document_id = $1 and action = 'approved'
      order by step_no`,
    [documentId]
  );

  // fetch each signature image from S3 (skip ones without an image)
  const signatures = [];
  for (const s of steps) {
    let image = null;
    if (s.signature_url) {
      try { image = await getObjectBuffer(s.signature_url); } catch { image = null; }
    }
    signatures.push({ image, name: s.approver_name, title: letter.signatory_title || '' });
  }

  const pdf = await generateLetterPdf(doc, letter, { signatures });
  const key = `documents/${doc.id}/approved-${doc.run_no}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc.id, 'approved');

  return queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'generated_pdf','approved',$2,'application/pdf',$3,$4,$5)
     returning id, storage_key, file_name, created_at`,
    [doc.id, `${doc.doc_number.replace(/\//g, '-')}-approved.pdf`, pdf.length, key, uploadedBy]
  );
}
