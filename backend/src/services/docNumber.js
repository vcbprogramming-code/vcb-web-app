import { queryOne } from '../config/db.js';

/**
 * Look up the department label for a document code (e.g. '02B' → 'วิศวะ').
 * Falls back to 'วิศวะ' when the code isn't mapped, per the client's rule.
 */
export async function departmentForDocCode(docCode) {
  const row = await queryOne(
    `select department from doc_code_departments where code = $1`,
    [docCode]
  );
  return row?.department ?? 'วิศวะ';
}

/** The default recipient title ("เรียน") configured for a doc code, or null. */
export async function recipientTitleForDocCode(docCode) {
  const row = await queryOne(
    `select recipient_title from doc_code_departments where code = $1`,
    [docCode]
  );
  return row?.recipient_title ?? null;
}

/**
 * Compute the next per-project running number for a project.
 * Each project keeps its own series, so we take MAX(run_no)+1 within the project.
 * NOTE: for the actual insert, allocation happens inside a transaction with a
 * row lock (see allocateDocNumber) to avoid two concurrent creates colliding.
 */
export async function peekNextRunNo(client, projectId) {
  const { rows } = await client.query(
    `select coalesce(max(run_no), 0) + 1 as next from documents where project_id = $1`,
    [projectId]
  );
  return rows[0].next;
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
 * Atomically allocate the next run number + full doc number for a project,
 * within an existing transaction. Locks the project's existing rows so two
 * concurrent inserts can't grab the same run_no.
 *
 * Returns { runNo, docNumber, department }.
 */
export async function allocateDocNumber(client, { project, docCode }) {
  const department = await departmentForDocCode(docCode);

  // Serialize allocation per project: lock the project row.
  await client.query('select id from projects where id = $1 for update', [project.id]);

  const { rows } = await client.query(
    `select coalesce(max(run_no), 0) + 1 as next from documents where project_id = $1`,
    [project.id]
  );
  const runNo = rows[0].next;

  const docNumber = formatDocNumber({
    prefix: project.doc_prefix,
    department,
    docCode,
    runNo,
  });

  return { runNo, docNumber, department };
}
