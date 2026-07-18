import crypto from 'node:crypto';
import { sendApprovalRequest } from './email.js';

/** A random URL-safe token for a one-time approval link. */
function makeToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/** Token lifetime: 14 days from now (ISO string). */
function tokenExpiry() {
  return new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
}

/**
 * Create the approval chain for a document and kick off step 1.
 * `approvers` is an ordered array of { name, email }.
 * Runs inside the given transaction client. Sets document status to 'pending'.
 * Returns the first step (so the caller can email it after commit).
 */
export async function createApprovalChain(client, { documentId, approvers, actorLabel, actorId }) {
  if (!approvers?.length) throw new Error('At least one approver is required');

  // Clear any previous chain (e.g. when re-submitting a returned doc).
  await client.query('delete from approval_steps where document_id = $1', [documentId]);

  const created = [];
  for (let i = 0; i < approvers.length; i++) {
    const a = approvers[i];
    // Link the step to the approver's account (matched by email) so the approved
    // PDF prints THEIR job title under the signature (not the letterhead default)
    // and their saved profile signature can be used. Null for external emails.
    const acct = await client
      .query('select id from profiles where lower(email) = lower($1) and is_active = true limit 1', [a.email])
      .then((r) => r.rows[0]);
    const { rows } = await client.query(
      `insert into approval_steps
         (document_id, step_no, approver_name, approver_email, approver_id, action, is_signer,
          action_token, token_expires_at)
       values ($1,$2,$3,$4,$5,'pending',$6,null,null)
       returning id, step_no, approver_name, approver_email, approver_id, is_signer`,
      [documentId, i + 1, a.name || null, a.email, acct?.id || null, Boolean(a.isSigner)]
    );
    created.push(rows[0]);
  }

  // If the signer (step 1 = ผู้จัดการโครงการ/ผู้ลงนาม) IS the person submitting,
  // they can't/needn't approve their own document — auto-approve that step and
  // stamp their profile signature, so the chain advances straight to the execs.
  let activateIdx = 0;
  const signer = created[0];
  if (signer?.is_signer && actorId && signer.approver_id === actorId) {
    const { rows: pr } = await client.query('select signature_url from profiles where id = $1', [actorId]);
    await client.query(
      `update approval_steps set action = 'approved', acted_at = now(), signature_url = $2,
              comment = 'ผู้จัดทำเป็นผู้จัดการโครงการ/ผู้ลงนาม (อนุมัติอัตโนมัติ)'
        where id = $1`,
      [signer.id, pr[0]?.signature_url || null]
    );
    await client.query(
      `insert into audit_log (document_id, actor_id, actor_label, action, detail)
       values ($1,$2,$3,'approved',$4)`,
      [documentId, actorId, actorLabel || null, JSON.stringify({ step_no: 1, auto: true })]
    );
    activateIdx = 1;
  }

  // Activate the next open step (issue its token) — the one to email.
  let firstToEmail = null;
  if (created[activateIdx]) {
    const { rows: act } = await client.query(
      `update approval_steps set action_token = $1, token_expires_at = $2 where id = $3
       returning id, step_no, approver_name, approver_email, action_token`,
      [makeToken(), tokenExpiry(), created[activateIdx].id]
    );
    firstToEmail = act[0];
  }

  // If the signer was auto-approved and there are no further steps, the doc is
  // fully approved already; otherwise it's pending.
  const finalized = activateIdx >= created.length;
  await client.query(`update documents set status = $1 where id = $2`, [finalized ? 'approved' : 'pending', documentId]);

  await client.query(
    `insert into audit_log (document_id, actor_id, actor_label, action, detail)
     values ($1,$2,$3,'submitted',$4)`,
    [documentId, actorId || null, actorLabel || null, JSON.stringify({ steps: approvers.length })]
  );

  return { firstStep: firstToEmail, finalized };
}

/**
 * Apply an approval action coming from a tokenised email link.
 * action ∈ 'approved' | 'rejected' | 'returned'.
 *
 * - approved: mark step done. If more steps remain, activate the next step
 *   (issue its token) and return it so the caller can email it. If it was the
 *   last step, set the document to 'approved'.
 * - rejected / returned: mark step + document accordingly; chain stops.
 *
 * Runs inside a transaction. Returns { document, step, nextStep|null, doc }.
 */
export async function applyApprovalAction(client, { token, stepId, action, comment, signatureUrl }) {
  if (!['approved', 'rejected', 'returned'].includes(action)) {
    throw new Error('Invalid action');
  }

  // The step can be located by its one-time token (email flow) OR by its id
  // (authenticated in-app flow, where the caller's identity was already verified).
  const { rows: steps } = stepId
    ? await client.query(
        `select s.*, d.doc_number, d.subject
           from approval_steps s join documents d on d.id = s.document_id
          where s.id = $1 for update`, [stepId])
    : await client.query(
        `select s.*, d.doc_number, d.subject
           from approval_steps s join documents d on d.id = s.document_id
          where s.action_token = $1 for update`, [token]);
  const step = steps[0];
  if (!step) return { error: 'invalid_token' };
  if (step.action !== 'pending') return { error: 'already_actioned', step };
  // token expiry only applies to the email flow (stepId flow is a live session)
  if (!stepId && step.token_expires_at && new Date(step.token_expires_at) < new Date()) {
    return { error: 'expired', step };
  }

  // Resolve the signature image: prefer one supplied now, else the approver's
  // stored profile signature (if they have an account).
  let sigUrl = signatureUrl || null;
  if (!sigUrl && step.approver_id) {
    const { rows: pr } = await client.query(
      'select signature_url from profiles where id = $1',
      [step.approver_id]
    );
    sigUrl = pr[0]?.signature_url || null;
  }

  // Record this step's action; consume its token; store the signature.
  await client.query(
    `update approval_steps
        set action = $1, comment = $2, acted_at = now(), action_token = null,
            signature_url = coalesce($4, signature_url)
      where id = $3`,
    [action, comment || null, step.id, sigUrl]
  );

  await client.query(
    `insert into audit_log (document_id, actor_label, action, detail)
     values ($1,$2,$3,$4)`,
    [
      step.document_id,
      step.approver_name || step.approver_email,
      action,
      JSON.stringify({ step_no: step.step_no, comment: comment || null }),
    ]
  );

  let nextStep = null;
  let docStatus;

  if (action === 'approved') {
    const { rows: next } = await client.query(
      `select id from approval_steps
        where document_id = $1 and step_no = $2`,
      [step.document_id, step.step_no + 1]
    );
    if (next[0]) {
      // activate the next step: issue its token
      const { rows: activated } = await client.query(
        `update approval_steps
            set action_token = $1, token_expires_at = $2
          where id = $3
          returning id, step_no, approver_name, approver_email, action_token`,
        [makeToken(), tokenExpiry(), next[0].id]
      );
      nextStep = activated[0];
      docStatus = 'pending';
    } else {
      docStatus = 'approved';
    }
  } else {
    // rejected or returned → terminal for the chain
    docStatus = action; // 'rejected' | 'returned'
  }

  await client.query(`update documents set status = $1 where id = $2`, [docStatus, step.document_id]);

  const { rows: docRows } = await client.query(
    `select id, doc_number, subject, status from documents where id = $1`,
    [step.document_id]
  );

  // finalized = the whole chain approved (document is now 'approved').
  return { step, nextStep, document: docRows[0], finalized: docStatus === 'approved' };
}

/**
 * Forward / delegate the CURRENT approval step to a different person.
 * Re-points the same step (same step_no, same position in the chain) at a new
 * approver, issues a fresh token, and returns the updated step so the caller can
 * email it. The original recipient's token is consumed (replaced).
 *
 * Runs inside a transaction. Returns { step, document } or { error }.
 */
export async function forwardApprovalStep(client, { token, toEmail, toName, comment }) {
  const { rows: steps } = await client.query(
    `select s.*, d.doc_number, d.subject
       from approval_steps s join documents d on d.id = s.document_id
      where s.action_token = $1
      for update`,
    [token]
  );
  const step = steps[0];
  if (!step) return { error: 'invalid_token' };
  if (step.action !== 'pending') return { error: 'already_actioned' };
  if (step.token_expires_at && new Date(step.token_expires_at) < new Date()) {
    return { error: 'expired' };
  }

  // The forwardee must be an active account: the emailed link is login-gated, so
  // delegating to a non-account address would send a dead link no one can act on.
  const acct = await client
    .query('select id, full_name from profiles where lower(email) = lower($1) and is_active = true', [toEmail])
    .then((r) => r.rows[0]);
  if (!acct) return { error: 'no_account' };

  const { rows: updated } = await client.query(
    `update approval_steps
        set approver_name = $1, approver_email = $2, approver_id = $3,
            action_token = $4, token_expires_at = $5
      where id = $6
      returning id, step_no, approver_name, approver_email, action_token`,
    [toName || acct.full_name || null, toEmail, acct.id, makeToken(), tokenExpiry(), step.id]
  );

  await client.query(
    `insert into audit_log (document_id, actor_label, action, detail)
     values ($1,$2,'forwarded',$3)`,
    [
      step.document_id,
      step.approver_name || step.approver_email,
      JSON.stringify({ step_no: step.step_no, to: toEmail, comment: comment || null }),
    ]
  );

  return {
    step: updated[0],
    document: { id: step.document_id, doc_number: step.doc_number, subject: step.subject },
  };
}

export { sendApprovalRequest };
