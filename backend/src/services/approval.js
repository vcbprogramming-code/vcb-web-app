import crypto from 'node:crypto';
import { Document, Profile } from '../models/index.js';
import { sendApprovalRequest } from './email.js';

/** A random URL-safe token for a one-time approval link. */
function makeToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/** Token lifetime: 14 days from now (Date). */
function tokenExpiry() {
  return new Date(Date.now() + 14 * 24 * 3600 * 1000);
}

/** Shape a stored approval step for the caller (e.g. to email it). */
function stepView(s) {
  return {
    id: String(s._id),
    step_no: s.stepNo,
    approver_name: s.approverName,
    approver_email: s.approverEmail,
    action_token: s.actionToken,
  };
}

/**
 * Create the approval chain for a document and arm step 1.
 * `approvers` is an ordered array of { name, email }. Rebuilds the embedded
 * chain (clearing any previous one), sets status to 'pending', appends an
 * audit entry. Returns the first step so the caller can email it.
 */
export async function createApprovalChain({ documentId, approvers, actorLabel, actorId }) {
  if (!approvers?.length) throw new Error('At least one approver is required');

  const steps = approvers.map((a, i) => ({
    stepNo: i + 1,
    approverName: a.name || null,
    approverEmail: a.email,
    action: 'pending',
    // only the active (first) step gets a live token; later steps get theirs
    // when the chain advances to them
    actionToken: i === 0 ? makeToken() : null,
    tokenExpiresAt: i === 0 ? tokenExpiry() : null,
  }));

  const doc = await Document.findByIdAndUpdate(
    documentId,
    {
      $set: { approvalSteps: steps, status: 'pending' },
      $push: {
        audit: {
          actorId: actorId || null,
          actorLabel: actorLabel || null,
          action: 'submitted',
          detail: { steps: approvers.length },
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );
  if (!doc) throw new Error('Document not found');

  return stepView(doc.approvalSteps[0]);
}

/**
 * Apply an approval action coming from a tokenised email link.
 * action ∈ 'approved' | 'rejected' | 'returned'.
 *
 * The step is consumed atomically: the update matches the exact step that still
 * holds this token AND is still 'pending'. If a concurrent request already
 * consumed it, the update matches nothing and we report 'already_actioned'.
 *
 * Returns { step, nextStep|null, document, finalized } or { error }.
 */
export async function applyApprovalAction({ token, action, comment, signatureUrl }) {
  if (!['approved', 'rejected', 'returned'].includes(action)) {
    throw new Error('Invalid action');
  }

  // Locate the document + step for validation / signature resolution.
  const current = await Document.findOne({ 'approvalSteps.actionToken': token }).lean();
  if (!current) return { error: 'invalid_token' };
  const step = current.approvalSteps.find((s) => s.actionToken === token);
  if (!step) return { error: 'invalid_token' };
  if (step.tokenExpiresAt && new Date(step.tokenExpiresAt) < new Date()) {
    return { error: 'expired', step };
  }

  // Resolve the signature image: prefer one supplied now, else the approver's
  // stored profile signature (if they have an account).
  let sigUrl = signatureUrl || null;
  if (!sigUrl && step.approverId) {
    const pr = await Profile.findById(step.approverId).select('signatureUrl').lean();
    sigUrl = pr?.signatureUrl || null;
  }

  // Atomic consume: flip exactly the step that still has this token & is pending.
  const set = {
    'approvalSteps.$[s].action': action,
    'approvalSteps.$[s].comment': comment || null,
    'approvalSteps.$[s].actedAt': new Date(),
    'approvalSteps.$[s].actionToken': null,
  };
  if (sigUrl) set['approvalSteps.$[s].signatureUrl'] = sigUrl;

  const consumed = await Document.findOneAndUpdate(
    { 'approvalSteps.actionToken': token },
    {
      $set: set,
      $push: {
        audit: {
          actorLabel: step.approverName || step.approverEmail,
          action,
          detail: { step_no: step.stepNo, comment: comment || null },
          createdAt: new Date(),
        },
      },
    },
    {
      arrayFilters: [{ 's.actionToken': token, 's.action': 'pending' }],
      new: true,
    }
  );

  // Nothing matched the array filter → the token was already consumed.
  if (!consumed) return { error: 'already_actioned', step };

  let nextStep = null;
  let docStatus;

  if (action === 'approved') {
    const next = consumed.approvalSteps.find((s) => s.stepNo === step.stepNo + 1);
    if (next) {
      // activate the next step: issue its token
      const newToken = makeToken();
      const activated = await Document.findOneAndUpdate(
        { _id: consumed._id },
        {
          $set: {
            'approvalSteps.$[n].actionToken': newToken,
            'approvalSteps.$[n].tokenExpiresAt': tokenExpiry(),
          },
        },
        { arrayFilters: [{ 'n.stepNo': next.stepNo }], new: true }
      );
      const activatedStep = activated.approvalSteps.find((s) => s.stepNo === next.stepNo);
      nextStep = stepView(activatedStep);
      docStatus = 'pending';
    } else {
      docStatus = 'approved';
    }
  } else {
    // rejected or returned → terminal for the chain
    docStatus = action; // 'rejected' | 'returned'
  }

  const finalDoc = await Document.findByIdAndUpdate(
    consumed._id,
    { $set: { status: docStatus } },
    { new: true }
  ).lean();

  const document = {
    id: String(finalDoc._id),
    doc_number: finalDoc.docNumber,
    subject: finalDoc.subject,
    status: finalDoc.status,
  };

  return {
    step: stepView(step),
    nextStep,
    document,
    finalized: docStatus === 'approved',
  };
}

export { sendApprovalRequest };
