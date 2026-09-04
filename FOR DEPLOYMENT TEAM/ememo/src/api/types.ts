// TypeScript mirror of the Apps Script (Code.js) server API contracts.
// Every shape here matches what the GAS function returns to the client via
// google.script.run. The mock layer (mock.ts) implements these; a real
// google.script.run bridge could implement the same `Api` interface later.

export type Status = 'pending' | 'commented' | 'approved' | 'rejected'
export type ReviewAction = 'comment' | 'approve' | 'reject' | 'reopen' | 'delete' | 'mango'

/** One register row, as returned inside getDocuments()'s per-project arrays. */
export interface DocRow {
  num: number
  date: string            // "dd/MM/yyyy"
  code: string            // "02A" | "08" | "" (unclassified)
  subject: string
  desc: string            // summary (may be empty)
  url: string             // Drive link or ""
  id: string              // docKey: url, or "project|subject|date"
  ref: string             // Remarks column (auto ref or note)
  status: Status
}

/** getDocuments(authToken) → register grouped by project. */
export type DocumentsByProject = Record<string, DocRow[]>

/** getLetterheadMeta() */
export interface LetterheadMeta {
  projects: string[]
  defaults: Record<string, string>   // project → suggested เรียน recipient
}

/** getDepartments() item */
export interface Department {
  key: string
  label: string
}

/** getReviewerRole(token) */
export interface ReviewerRole {
  signedIn: boolean
  email: string
  manager: boolean
}

/** claimAuth(state) — {} when pending/expired */
export interface ClaimAuthResult {
  token?: string
  email?: string
}

/** One entry in a document's discussion thread (getReview().entries). */
export interface ReviewEntry {
  time: string            // "dd/MM/yyyy HH:mm"
  email: string
  action: ReviewAction
  text: string            // plain text, "INK:<dataURL>\n<note>", or packed with ␟CC␟
}

/** getReview(docId) and every comment/decision mutation return this. */
export interface ReviewResult {
  ok: boolean
  status: Status
  locked: boolean         // true once approved/rejected
  entries: ReviewEntry[]
  combinedHtml: string    // server-rendered letter+comments (mock leaves "")
  error?: string
}

/** Arguments shared by addReviewComment / reopenDocument / submitDecision. */
export interface ReviewMutationArgs {
  authToken: string
  docId: string
  project: string
  text: string
  ink: string
  ccDepts: string         // comma/space-separated dept keys
  ccEmails: string        // comma/space-separated raw emails
}
export interface DecisionArgs extends ReviewMutationArgs {
  decision: 'approve' | 'reject'
}

export interface MangoArgs { authToken: string; docId: string; project: string }
export interface MangoResult { ok: boolean; demo?: boolean; message?: string; mangoId?: string; error?: string }

export interface DeleteDocArgs { authToken: string; docId: string; project: string }
export interface SimpleOk { ok: boolean; error?: string }

/** previewLetter(args) */
export interface PreviewLetterArgs {
  project: string; code: string; subject: string
  to: string; cc: string; typist: string; body: string; docDate: string
}
export interface PreviewLetterResult { ok: boolean; ref?: string; html?: string; error?: string }

/** submitDocument(args) */
export interface SubmitDocumentArgs {
  authToken: string
  project: string; code: string; subject: string; docDate: string
  to: string; cc: string; typist: string; body: string
  filename: string; fileBase64: string; mimeType: string
}
export interface SubmitDocumentResult {
  success: boolean
  fileUrl?: string
  placed?: boolean
  generated?: boolean
  ref?: string
  attachUrl?: string
  editUrl?: string
  letterHtml?: string
  pending?: boolean
  token?: string
  error?: string
}

/** finalizeLetter(args) */
export interface FinalizeLetterArgs {
  authToken: string
  project: string; code: string; ref: string
  subject: string; to: string; cc: string; typist: string; body: string; docDate: string
  token: string
}
export interface FinalizeLetterResult { ok: boolean; url?: string; editUrl?: string; error?: string }

/** Drive / Gmail attachment streaming. */
export interface StreamFileResult {
  ok: boolean
  name?: string
  mime?: string
  sizeKb?: number
  base64?: string
  isNative?: boolean
  previewUrl?: string
  error?: string
  tooLarge?: boolean
}
export interface DocAttachment { source: string; id: string; name: string; mime: string; url: string }
export interface DocAttachmentsResult { ok: boolean; atts?: DocAttachment[]; threadId?: string; error?: string }

/** Access-control config (admin only). */
export interface AccessRule { conf: boolean; allow: string[] }
export interface AccessRules { codes: Record<string, AccessRule>; projects: Record<string, AccessRule> }
export interface AccessConfigResult {
  ok: boolean
  isAdmin: boolean
  email?: string
  rules?: AccessRules
  codeLabels?: Record<string, string>
  // Every project key with at least one document — renderAccessConfig()'s own
  // "โครงการ / Projects" group in the original scans RAW/PROJ_NAMES for this;
  // the mock returns the equivalent list rather than the UI re-deriving it.
  projectKeys?: string[]
  defaultPublicPrefixes?: string[]
  error?: string
}
export interface SetAccessConfigResult { ok: boolean; rules?: AccessRules; error?: string }

/** The full server surface the UI depends on. mock.ts implements it. */
export interface Api {
  getDocuments(authToken: string): Promise<DocumentsByProject>
  getLetterheadMeta(): Promise<LetterheadMeta>
  getDepartments(): Promise<Department[]>
  getReviewerRole(token: string): Promise<ReviewerRole>
  getOAuthUrl(state: string): Promise<string>
  claimAuth(state: string): Promise<ClaimAuthResult>
  getReview(docId: string): Promise<ReviewResult>
  addReviewComment(args: ReviewMutationArgs): Promise<ReviewResult>
  reopenDocument(args: ReviewMutationArgs): Promise<ReviewResult>
  submitDecision(args: DecisionArgs): Promise<ReviewResult>
  deleteOwnLastEntry(authToken: string, docId: string): Promise<ReviewResult>
  sendToMangoERP(args: MangoArgs): Promise<MangoResult>
  deleteDocument(args: DeleteDocArgs): Promise<SimpleOk>
  previewLetter(args: PreviewLetterArgs): Promise<PreviewLetterResult>
  submitDocument(args: SubmitDocumentArgs): Promise<SubmitDocumentResult>
  finalizeLetter(args: FinalizeLetterArgs): Promise<FinalizeLetterResult>
  streamFileForViewer(id: string): Promise<StreamFileResult>
  streamGmailAttachment(tid: string, mi: number, ai: number): Promise<StreamFileResult>
  getDocAttachments(docId: string, authToken: string): Promise<DocAttachmentsResult>
  getAccessConfig(authToken: string): Promise<AccessConfigResult>
  setAccessConfig(authToken: string, jsonPayload: string): Promise<SetAccessConfigResult>
}
