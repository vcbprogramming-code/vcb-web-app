import QRCode from 'qrcode';
import { query, queryOne } from '../config/db.js';
import { putObject, deleteObject, getObjectBuffer } from '../config/storage.js';
import { generateLetterPdf } from './letterhead.js';
import { env } from '../config/env.js';

/** Build the QR PNG buffer that links to the public verify page (#6). Returns
 *  null on any failure so PDF generation never breaks over the QR. */
async function buildVerifyQr(doc) {
  if (!doc?.verify_token) return null;
  const url = `${env.appBaseUrl.replace(/\/$/, '')}/verify/${doc.verify_token}`;
  try {
    return { buffer: await QRCode.toBuffer(url, { margin: 1, width: 160, errorCorrectionLevel: 'M' }), url };
  } catch { return null; }
}

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
  // The signature block shows the *signer* (may differ from the preparer). When
  // no explicit signer is set on the doc, fall back to the author (preparer).
  if (doc) {
    doc.signer_name = doc.signer_name || doc.author_name;
    doc.signer_title = doc.signer_title || doc.author_title;
    doc.preparer_name = doc.author_name; // always the logged-in creator
  }
  if (!doc) throw new Error('Document not found');
  const row = await queryOne(
    'select * from project_letterhead where project_id = $1',
    [doc.project_id]
  );
  const letter = toCamelLetter(row);

  // Company identity (name/logo/contact) overrides the project letterhead. Use
  // the company chosen for this doc, else the default company. Signatory/closing
  // defaults still come from the project letterhead.
  const company = await queryOne(
    doc.company_id
      ? 'select * from companies where id = $1'
      : 'select * from companies where is_default = true limit 1',
    doc.company_id ? [doc.company_id] : []
  );
  if (company) {
    letter.companyName = company.name || letter.companyName;
    letter.companyNameEn = company.name_en || letter.companyNameEn;
    letter.address = company.address || letter.address;
    letter.logoUrl = company.logo_url || letter.logoUrl;
    letter.phone = company.phone || letter.phone;
    letter.telex = company.telex || letter.telex;
    letter.fax = company.fax || letter.fax;
  }

  // The logo is an S3 key (companies) — fetch its bytes so the PDF generator can
  // embed it (pdfkit can't read from S3). Falls back to the bundled asset logo.
  if (letter.logoUrl) {
    letter.logoBuffer = await getObjectBuffer(letter.logoUrl).catch(() => null);
  }
  // Per-project signature image (#6): the signatory's saved signature is stamped
  // automatically under "ขอแสดงความนับถือ" on every memo — no need to sign each
  // one. Fetch its bytes here so letterhead.js can embed it.
  if (letter.signatureUrl) {
    letter.signatureBuffer = await getObjectBuffer(letter.signatureUrl).catch(() => null);
  }
  return { doc, letter };
}

/**
 * Map a snake_case project_letterhead DB row to the camelCase keys the PDF
 * generator (letterhead.js) reads. Without this the per-project company name,
 * signatory, contact block and logo were silently dropped (letterhead.js read
 * letter.companyName while the row only had company_name), so every letter fell
 * back to the hardcoded default company. Returns {} for a missing row.
 */
function toCamelLetter(row) {
  if (!row) return {};
  return {
    companyName: row.company_name,
    companyNameEn: row.company_name_en,
    address: row.address,
    logoUrl: row.logo_url,
    phone: row.phone,
    telex: row.telex,
    fax: row.fax,
    signatoryName: row.signatory_name,
    signatoryTitle: row.signatory_title,
    signatureUrl: row.signature_url,
    closingLine: row.closing_line,
    defaultRecipient: row.default_recipient,
  };
}

/** Remove any existing generated attachment of a given version for a doc. */
async function clearVersion(documentId, version, keepKey = null) {
  const old = await query(
    `select id, storage_key from document_attachments
      where document_id = $1 and version = $2 and kind = 'generated_pdf'`,
    [documentId, version]
  );
  for (const o of old.rows) {
    // Never delete the object we just wrote: the storage key is deterministic
    // (original-<run_no>.pdf), so on a regenerate the old row's key == the new
    // key. Deleting it would orphan the fresh PDF → 404 on download.
    if (o.storage_key !== keepKey) await deleteObject(o.storage_key).catch(() => {});
    await query('delete from document_attachments where id = $1', [o.id]);
  }
}

/**
 * Generate the ORIGINAL letter PDF (no approver signatures) from the letterhead,
 * store it on S3, and record it as a generated, version='original' attachment.
 * Returns { id, storage_key, file_name }.
 */
/**
 * Regenerate the ORIGINAL PDF with the decision trail page appended — used when
 * a document is returned/rejected so the reason is captured in the document.
 */
export async function regenerateOriginalWithAudit(documentId, uploadedBy = null) {
  const { doc, letter } = await loadDocAndLetter(documentId);
  // returned/rejected → back to an unsigned letter; the decision trail is appended.
  const authorSignature = null;
  const { rows: auditSteps } = await query(
    `select approver_name, approver_email, action, comment, acted_at
       from approval_steps where document_id = $1 order by step_no`,
    [documentId]
  );
  const qr = await buildVerifyQr(doc);
  // keep the "original" clean like generateOriginalPdf — the reviewer comments live
  // on the appended "บันทึกการพิจารณา" trail page, not a page-1 box.
  const pdf = await generateLetterPdf(doc, letter, { authorSignature, auditSteps, commentBox: false, qr });
  const key = `documents/${doc.id}/original-${doc.run_no}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc.id, 'original', key);
  return queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'generated_pdf','original',$2,'application/pdf',$3,$4,$5)
     returning id, storage_key, file_name, created_at`,
    [doc.id, `${doc.doc_number.replace(/\//g, '-')}.pdf`, pdf.length, key, uploadedBy]
  );
}

export async function generateOriginalPdf(documentId, uploadedBy = null) {
  const { doc, letter } = await loadDocAndLetter(documentId);
  // No signature on the ORIGINAL: the ผู้ลงนาม (project manager) signs only when
  // they APPROVE (first step). Until then the "ขอแสดงความนับถือ" block shows the
  // name with a blank signature line.
  const qr = await buildVerifyQr(doc);
  const pdf = await generateLetterPdf(doc, letter, { authorSignature: null, commentBox: false, qr });
  const key = `documents/${doc.id}/original-${doc.run_no}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc.id, 'original', key);

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
    `select s.approver_name, s.signature_url, s.is_signer, pr.job_title as approver_title,
            pr.signature_url as profile_signature
       from approval_steps s
       left join profiles pr on pr.id = s.approver_id
      where s.document_id = $1 and s.action = 'approved'
      order by s.step_no`,
    [documentId]
  );

  // Split the SIGNER (ผู้จัดการโครงการ/ผู้ลงนาม) from the ผู้อนุมัติ: the signer's
  // signature goes under "ขอแสดงความนับถือ" (as authorSignature), the rest fill the
  // ผู้อนุมัติ row — so a signer who also approved never appears twice.
  // Signature image: the one captured when they approved, else their profile one.
  // Title: each approver's OWN job title (no borrowing the letterhead's).
  let signerSignature = null;
  const signatures = [];
  for (const s of steps) {
    let image = null;
    const sigKey = s.signature_url || s.profile_signature;
    if (sigKey) {
      try { image = await getObjectBuffer(sigKey); } catch { image = null; }
    }
    if (s.is_signer) signerSignature = image;
    else signatures.push({ image, name: s.approver_name, title: s.approver_title || '' });
  }

  // full decision trail for the "บันทึกการพิจารณา" page
  const { rows: auditSteps } = await query(
    `select approver_name, approver_email, action, comment, acted_at
       from approval_steps where document_id = $1 order by step_no`,
    [documentId]
  );

  // conversation thread (บันทึก/ขอความเห็น) — surfaced on the comment page (#14)
  const { rows: messages } = await query(
    `select m.body, m.kind, coalesce(pr.full_name, m.author_label) as author_name
       from document_messages m
       left join profiles pr on pr.id = m.author_id
      where m.document_id = $1 order by m.created_at`,
    [documentId]
  );

  const qr = await buildVerifyQr(doc);
  const pdf = await generateLetterPdf(doc, letter, { authorSignature: signerSignature, signatures, auditSteps, messages, qr });
  const key = `documents/${doc.id}/approved-${doc.run_no}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc.id, 'approved', key);

  return queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'generated_pdf','approved',$2,'application/pdf',$3,$4,$5)
     returning id, storage_key, file_name, created_at`,
    [doc.id, `${doc.doc_number.replace(/\//g, '-')}-approved.pdf`, pdf.length, key, uploadedBy]
  );
}
