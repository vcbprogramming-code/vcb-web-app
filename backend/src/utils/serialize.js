/**
 * Serializers that turn Mongoose documents into the snake_case JSON shapes the
 * frontend already expects (the API contract didn't change with the DB swap).
 */

const id = (v) => (v == null ? null : String(v));

export function profileOut(p) {
  if (!p) return null;
  return {
    id: id(p._id),
    full_name: p.fullName ?? null,
    email: p.email,
    role: p.role,
    unit_id: id(p.unitId),
    unit_ids: (p.unitIds || []).map((u) => id(u)),
    is_active: p.isActive,
    created_at: p.createdAt,
    signature_url: p.signatureUrl ?? null,
  };
}

export function projectOut(p) {
  if (!p) return null;
  return {
    id: id(p._id),
    code: p.code,
    name: p.name,
    doc_prefix: p.docPrefix,
    color: p.color ?? null,
    sort_order: p.sortOrder,
    is_active: p.isActive,
  };
}

export function docTypeOut(t) {
  if (!t) return null;
  return { id: id(t._id), name: t.name, sort_order: t.sortOrder };
}

export function letterheadOut(l) {
  if (!l) return null;
  return {
    company_name: l.companyName ?? null,
    company_name_en: l.companyNameEn ?? null,
    address: l.address ?? null,
    logo_url: l.logoUrl ?? null,
    phone: l.phone ?? null,
    telex: l.telex ?? null,
    fax: l.fax ?? null,
    signatory_name: l.signatoryName ?? null,
    signatory_title: l.signatoryTitle ?? null,
    signature_url: l.signatureUrl ?? null,
    closing_line: l.closingLine ?? null,
    default_recipient: l.defaultRecipient ?? null,
  };
}

/** A document row for the register list (project may be populated). */
export function docListItem(d) {
  const project = d.projectId && typeof d.projectId === 'object' ? d.projectId : null;
  const docType = d.docTypeId && typeof d.docTypeId === 'object' ? d.docTypeId : null;
  return {
    id: id(d._id),
    doc_number: d.docNumber,
    doc_code: d.docCode,
    department: d.department,
    run_no: d.runNo,
    subject: d.subject,
    recipient: d.recipient ?? null,
    remarks: d.remarks ?? null,
    date_received: d.dateReceived,
    status: d.status,
    source: d.source,
    sender_email: d.senderEmail ?? null,
    created_at: d.createdAt,
    project_id: id(project ? project._id : d.projectId),
    project_code: project?.code ?? null,
    project_color: project?.color ?? null,
    doc_type_id: id(docType ? docType._id : d.docTypeId),
    doc_type_name: docType?.name ?? null,
  };
}

/** Full document detail incl. embedded attachments / steps / audit. */
export function docDetail(d) {
  return {
    ...docListItem(d),
    body: d.body ?? null,
    work_unit: d.workUnit ?? null,
    enclosures: (d.enclosures || []).map((e) => ({ name: e.name, qty: e.qty, unit: e.unit })),
    attachments: (d.attachments || []).map(attachmentOut),
    approval_steps: (d.approvalSteps || [])
      .slice()
      .sort((a, b) => a.stepNo - b.stepNo)
      .map(stepOut),
    audit: (d.audit || [])
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((a) => ({
        action: a.action,
        actor_label: a.actorLabel ?? null,
        detail: a.detail ?? null,
        created_at: a.createdAt,
      })),
  };
}

export function attachmentOut(a) {
  return {
    id: id(a._id),
    kind: a.kind,
    version: a.version ?? null,
    file_name: a.fileName,
    content_type: a.contentType ?? null,
    size_bytes: a.sizeBytes ?? null,
    created_at: a.createdAt,
  };
}

export function stepOut(s) {
  return {
    id: id(s._id),
    step_no: s.stepNo,
    approver_name: s.approverName ?? null,
    approver_email: s.approverEmail,
    action: s.action,
    comment: s.comment ?? null,
    acted_at: s.actedAt ?? null,
  };
}
