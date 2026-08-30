import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { REQUIRED_DOCUMENTS } from "../data/requiredDocuments";
import { ALL_DEPARTMENTS } from "../data/allDepartments";
import { useProgress } from "../lib/useProgress";
import { useDocUpload, type UploadedDocInfo } from "../lib/useDocUpload";
import { useT } from "../lib/LangContext";

// Ported from the original app's PAGES['required-documents'] (content.html)
// — doc list + Department Selection grid, which lived on one page there.
// Document "Complete" checkboxes and "Upload" buttons both write a
// progress row with a "doc::<id>" task id, matching the original app's
// REQUIRED_DOC_IDS convention (progress.html) — either action marks the
// same task done, same explicit requirement as the original ("either
// upload or checkbox marks a doc complete").
export function RequiredDocuments() {
  const { isTaskDone, toggleTask, name } = useProgress();
  const { t } = useT();
  // Per-employee upload receipts. localStorage only, deliberately: the
  // authoritative copy is the object in Supabase Storage, and this just
  // lets the employee confirm and open what they actually sent. Keyed by
  // name so switching identity doesn't surface someone else's uploads.
  // Mirrors setUploadedDocInfo/getUploadedDocs in the original app.
  const receiptsKey = `vcb-uploaded-docs::${(name ?? "").trim().toLowerCase()}`;
  const [uploaded, setUploaded] = useState<Record<string, UploadedDocInfo>>({});
  useEffect(() => {
    try {
      setUploaded(JSON.parse(localStorage.getItem(receiptsKey) || "{}"));
    } catch {
      setUploaded({});
    }
  }, [receiptsKey]);

  const { triggerUpload, uploadingDocId, uploadError, dismissUploadError } = useDocUpload(
    name,
    (docId, info) => {
      toggleTask(`doc::${docId}`);
      setUploaded((prev) => {
        const next = { ...prev, [docId]: info };
        try {
          localStorage.setItem(receiptsKey, JSON.stringify(next));
        } catch {
          /* storage blocked — the receipt is a convenience, not the record */
        }
        return next;
      });
    },
  );

  return (
    <div className="page">
      <h1>{t("Required Documents")}</h1>
      <p>{t("View, download, complete, and upload these eight documents before the first working day:")}</p>

      <div className="doc-grid">
        {REQUIRED_DOCUMENTS.map((doc) => {
          const taskId = `doc::${doc.id}`;
          const done = isTaskDone(taskId);
          return (
            <div key={doc.id} className={`doc-card${done ? " done" : ""}`}>
              <h3>{t(doc.title)}</h3>
              <p>{t(doc.desc)}</p>
              <div className="doc-card-actions">
                {doc.viewUrl && (
                  <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer">
                    {t(doc.action)}
                  </a>
                )}
                <button
                  type="button"
                  disabled={!name || uploadingDocId === doc.id}
                  onClick={() => triggerUpload(doc.id)}
                >
                  {uploadingDocId === doc.id ? t("Uploading…") : t("Upload")}
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={!name}
                    onChange={() => toggleTask(taskId)}
                  />
                  {t("Complete")}
                </label>
              </div>
              {uploaded[doc.id] && (
                <div className="doc-uploaded">
                  <span className="doc-uploaded-label">{t("You uploaded")}:</span>{" "}
                  <a href={uploaded[doc.id].url} target="_blank" rel="noopener noreferrer">
                    {uploaded[doc.id].fileName}
                  </a>{" "}
                  <span className="doc-uploaded-hint">{t("(uploading again replaces this)")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {uploadError && (
        <div className="form-error" role="alert">
          {t(uploadError)}{" "}
          <button type="button" onClick={dismissUploadError}>
            {t("Dismiss")}
          </button>
        </div>
      )}

      {!name && (
        <p className="hint">
          {t("Enter your name on a checklist page first to track document completion.")}
        </p>
      )}

      <h2>{t("Department Selection")}</h2>
      <p>{t("Choose the department you will spend your first 90 days in.")}</p>
      <div className="dept-grid">
        {ALL_DEPARTMENTS.map((dept) => (
          <Link key={dept.id} to={`/${dept.landingPageKey}`} className="dept-card">
            <h3>{t(dept.content.title)}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
