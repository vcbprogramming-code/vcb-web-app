import { Counter, DocCodeDepartment } from '../models/index.js';

/**
 * Look up the department label for a document code (e.g. '02B' → 'วิศวะ').
 * Falls back to 'วิศวะ' when the code isn't mapped, per the client's rule.
 */
export async function departmentForDocCode(docCode) {
  const row = await DocCodeDepartment.findById(docCode).lean();
  return row?.department ?? 'วิศวะ';
}

/** The default recipient title ("เรียน") configured for a doc code, or null. */
export async function recipientTitleForDocCode(docCode) {
  const row = await DocCodeDepartment.findById(docCode).lean();
  return row?.recipientTitle ?? null;
}

/**
 * Preview the next per-project running number WITHOUT allocating it.
 * Best-effort (the real allocation may race ahead under concurrency, same as
 * the old MAX(run_no)+1 peek).
 */
export async function peekNextRunNo(projectId) {
  const c = await Counter.findById(String(projectId)).lean();
  return (c?.seq ?? 0) + 1;
}

/**
 * Assemble the full document number string.
 * Format: <prefix>/<department>/<docCode>/<runNo3>  e.g. 'BT/วิศวะ/02B/069'
 * Run number is zero-padded to at least 3 digits to match the client's format.
 */
export function formatDocNumber({ prefix, department, docCode, runNo }) {
  const padded = String(runNo).padStart(3, '0');
  return `${prefix}/${department}/${docCode}/${padded}`;
}

/**
 * Atomically allocate the next run number + full doc number for a project.
 * Uses an atomic $inc on a per-project counter document — race-safe at the
 * database level, replacing the Postgres SELECT ... FOR UPDATE approach.
 *
 * `project` must have { _id|id, docPrefix }.
 * Returns { runNo, docNumber, department }.
 */
export async function allocateDocNumber({ project, docCode }) {
  const department = await departmentForDocCode(docCode);

  const projectId = String(project._id ?? project.id);
  const counter = await Counter.findByIdAndUpdate(
    projectId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const runNo = counter.seq;

  const docNumber = formatDocNumber({
    prefix: project.docPrefix,
    department,
    docCode,
    runNo,
  });

  return { runNo, docNumber, department };
}
