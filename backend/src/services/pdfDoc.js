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
  //
  // The TITLE may only be borrowed from the preparer when the preparer IS the
  // signer. Borrowing it unconditionally printed one person's name above another
  // person's job title, and — because doc.signer_title wins over the letterhead
  // downstream — it also overrode the ตำแหน่งผู้ลงนาม configured on the project.
  // Left blank here, the letterhead's own value (else "ผู้จัดการโครงการ") applies.
  if (doc) {
    const signerIsPreparer = !doc.signer_name || doc.signer_name === doc.author_name;
    doc.signer_title_borrowed = !doc.signer_title && signerIsPreparer && Boolean(doc.author_title);
    doc.signer_name = doc.signer_name || doc.author_name;
    doc.signer_title = doc.signer_title || (signerIsPreparer ? doc.author_title : null);
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
    // same name resolution as the signature block — the decision page printed raw
    // gmail addresses whenever a step carried no typed name.
    `select coalesce(nullif(pr.full_name,''), nullif(s.approver_name,''), s.approver_email) as approver_name,
            s.approver_email, s.action, s.comment, s.acted_at
       from approval_steps s
       left join profiles pr on pr.id = s.approver_id
      where s.document_id = $1 order by s.step_no`,
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
    // The account's own full_name/job_title win over whatever text was typed into
    // the step when the chain was built: the signature block must name the person
    // who actually signed, and a step created without a name printed "()" on a
    // formal letter.
    `select coalesce(nullif(pr.full_name,''), nullif(s.approver_name,''), s.approver_email) as approver_name,
            s.signature_url, s.is_signer, pr.job_title as approver_title,
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
    if (s.is_signer) {
      signerSignature = image;
      // Whoever actually signed step 1 IS the ผู้ลงนาม. loadDocAndLetter falls back
      // to the preparer when signer_name is blank, which printed the clerk's name
      // above the project manager's signature.
      const actualSigner = s.approver_name || doc.signer_name;
      // Same rule as loadDocAndLetter: a title borrowed from the preparer has to
      // go once the signer turns out to be somebody else, or the letter shows the
      // manager's name over the clerk's title.
      if (s.approver_title) doc.signer_title = s.approver_title;
      else if (doc.signer_title_borrowed && actualSigner !== doc.preparer_name) doc.signer_title = null;
      doc.signer_name = actualSigner;
    } else {
      signatures.push({ image, name: s.approver_name, title: s.approver_title || '' });
    }
  }

  // Full decision trail for the "บันทึกการพิจารณา" page.
  //
  // is_signer is carried through so the trail can drop the ผู้จัดการโครงการ's own
  // comment: the memo effectively comes FROM the project manager, so a note they
  // wrote to themselves has no business being read by the executives who sign
  // after them. Everyone else's reason still prints — for a rejection it is the
  // whole point of the page.
  const { rows: auditSteps } = await query(
    // same name resolution as the signature block — the decision page printed raw
    // gmail addresses whenever a step carried no typed name.
    `select coalesce(nullif(pr.full_name,''), nullif(s.approver_name,''), s.approver_email) as approver_name,
            s.approver_email, s.action, s.acted_at, s.is_signer,
            case when s.is_signer then null else s.comment end as comment
       from approval_steps s
       left join profiles pr on pr.id = s.approver_id
      where s.document_id = $1 order by s.step_no`,
    [documentId]
  );

  const qr = await buildVerifyQr(doc);
  // messages are deliberately NOT passed: the client asked for the separate
  // "ความเห็นและบันทึกการสนทนา" page to be dropped from the signed letter. The
  // conversation still lives in the document page and the audit trail.
  const pdf = await generateLetterPdf(doc, letter, { authorSignature: signerSignature, signatures, auditSteps, qr });
  const key = `documents/${doc.id}/approved-${doc.run_no}.pdf`;
  await putObject(key, pdf, 'application/pdf');
  await clearVersion(doc.id, 'approved', key);

  return queryOne(
    `insert into document_attachments
       (document_id, kind, version, file_name, content_type, size_bytes, storage_key, uploaded_by)
     values ($1,'generated_pdf','approved',$2,'application/pdf',$3,$4,$5)
     returning id, storage_key, file_name, created_at`,
    // Thai name: this file is handed to people who open it months later, and
    // "-approved" told them nothing in a system that is otherwise all Thai.
    [doc.id, `${doc.doc_number.replace(/\//g, '-')}-ฉบับลงนาม.pdf`, pdf.length, key, uploadedBy]
  );
}
