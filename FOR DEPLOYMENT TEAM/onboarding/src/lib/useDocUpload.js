// Uploading one of the eight required documents.
//
// Replaces the original app's triggerDocUpload/handleDocFileSelected
// (progress.html), which read the file as base64 and posted it to Code.gs, and
// then the Supabase-client version that called supabase.storage.upload()
// directly with the anon key. The browser no longer holds Supabase
// credentials, so the bytes go to a PRESIGNED URL the API signs:
//
//   1. GET /api/onboarding/documents/:name/path?doc_id=&ext=  ->  { bucket, path, uploadUrl }
//   2. PUT the file straight at uploadUrl (Supabase Storage, via S3)
//
// Step 2 never touches Express, so a 10MB scan does not occupy a worker for
// the length of the transfer or hit the 2MB JSON body limit — see
// api/src/lib/storage.js, which explains the same reasoning server-side.
//
// ---------------------------------------------------------------------------
// KNOWN GAP — the API does not sign this URL yet.
// ---------------------------------------------------------------------------
// api/src/routes/onboarding.js's /documents/:name/path returns { bucket, path }
// ONLY. api/src/lib/storage.js exports presignUpload(), but no onboarding route
// calls it, so there is currently no way for this browser to obtain an upload
// URL. Every other path in this module works; this one cannot until the API
// adds `uploadUrl` (and, for the receipt link, `downloadUrl`) to that response.
//
// This hook is written against that intended contract and degrades honestly:
// when the field is absent it reports uploadUnavailable rather than appearing
// to upload and silently discarding the file. Do NOT "fix" this by putting a
// Supabase key back in the browser — that is the exact coupling TECH_STACK.md
// forbids. See KNOWN_ISSUES.md.
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react';
import {
  ALLOWED_DOC_EXTENSIONS,
  MAX_DOC_UPLOAD_BYTES,
  getDocumentPath,
} from './onboardingApi.js';

export { ALLOWED_DOC_EXTENSIONS, MAX_DOC_UPLOAD_BYTES };

function extensionOf(fileName) {
  const i = String(fileName || '').lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

/**
 * @param {string|null} employeeName
 * @param {(docId: string, info: { fileName: string, url: string }) => void} onUploaded
 */
export function useDocUpload(employeeName, onUploaded) {
  const [uploadingDocId, setUploadingDocId] = useState(null);
  // A translation key, not prose — the UI renders it through t().
  const [uploadError, setUploadError] = useState(null);

  const triggerUpload = useCallback(
    (docId) => {
      if (!employeeName) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;

        // The accept attribute is only a file-picker filter — "All Files" in
        // the OS dialog bypasses it entirely. Validate for real, and give an
        // error the employee can act on rather than a blanket "try again"
        // that could never work for an oversized file.
        const ext = extensionOf(file.name);
        if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
          setUploadError('doc.errorType');
          return;
        }
        if (file.size === 0) {
          setUploadError('doc.errorEmpty');
          return;
        }
        if (file.size > MAX_DOC_UPLOAD_BYTES) {
          setUploadError('doc.errorTooLarge');
          return;
        }

        setUploadError(null);
        setUploadingDocId(docId);
        try {
          // The path is keyed by employee + docId + extension, NOT by the
          // uploaded filename: with the filename in the key, uploading a
          // differently-named file for the same requirement created a SECOND
          // object instead of replacing the first, and nobody could tell which
          // was current. The API owns that rule; the client just asks.
          const target = await getDocumentPath(employeeName, docId, ext);

          if (!target?.uploadUrl) {
            // See the KNOWN GAP note at the top of this file.
            setUploadError('doc.errorUploadUnavailable');
            return;
          }

          const res = await fetch(target.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          });
          if (!res.ok) {
            setUploadError('doc.errorFailed');
            return;
          }

          // Hand back what was actually stored so the card can show a
          // "You uploaded: <file>" receipt — the employee otherwise gets no
          // confirmation of what the server received.
          onUploaded(docId, { fileName: file.name, url: target.downloadUrl || '' });
        } catch {
          setUploadError('doc.errorFailed');
        } finally {
          setUploadingDocId(null);
        }
      });
      input.click();
    },
    [employeeName, onUploaded]
  );

  const dismissUploadError = useCallback(() => setUploadError(null), []);

  return { triggerUpload, uploadingDocId, uploadError, dismissUploadError };
}
