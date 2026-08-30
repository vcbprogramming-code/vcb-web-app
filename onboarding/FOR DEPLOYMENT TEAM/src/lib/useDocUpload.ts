import { useCallback, useState } from "react";
import { supabase } from "./supabaseClient";

// Replaces the original app's triggerDocUpload/handleDocFileSelected
// (progress.html) — which read the file as base64 and sent it to
// Code.gs's uploadRequiredDocument to save into a per-employee Drive
// subfolder. Here the file goes straight to Supabase Storage's
// "required-documents" bucket (see supabase/schema.sql).

// Mirrors MAX_DOC_UPLOAD_BYTES_/ALLOWED_DOC_EXTENSIONS_ in the original
// app's Code.gs. 10MB comfortably fits a phone photo of a document while
// staying well clear of Storage limits.
export const MAX_DOC_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOC_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];

export interface UploadedDocInfo {
  fileName: string;
  url: string;
}

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

export function useDocUpload(
  employeeName: string | null,
  onUploaded: (docId: string, info: UploadedDocInfo) => void,
) {
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const triggerUpload = useCallback(
    (docId: string) => {
      if (!employeeName) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;

        // The accept attribute above is only a file-picker filter —
        // "All Files" in the OS dialog bypasses it entirely. Validate for
        // real, and give an error the employee can act on rather than a
        // blanket "try again" that could never work for an oversized file.
        const ext = extensionOf(file.name);
        if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
          setUploadError("Unsupported file type. Please upload a PDF, image, or Word document.");
          return;
        }
        if (file.size === 0) {
          setUploadError("That file is empty. Please choose a different file.");
          return;
        }
        if (file.size > MAX_DOC_UPLOAD_BYTES) {
          setUploadError("That file is too large (limit 10MB). Please upload a smaller scan or photo.");
          return;
        }

        setUploadError(null);
        setUploadingDocId(docId);
        // Keyed by docId + extension ONLY — not the user's filename. With
        // the filename in the path, uploading a differently-named file for
        // the same requirement created a SECOND object rather than
        // replacing the first, so nobody could tell which was current.
        // Same reasoning as the original app naming the Drive file by
        // docId. upsert:true then genuinely replaces.
        const path = `${employeeName}/${docId}.${ext}`;
        const { error } = await supabase.storage
          .from("required-documents")
          .upload(path, file, { upsert: true, contentType: file.type || undefined });
        setUploadingDocId(null);
        if (error) {
          console.error("Document upload failed:", error);
          setUploadError(`Upload failed: ${error.message}`);
          return;
        }
        const { data } = supabase.storage.from("required-documents").getPublicUrl(path);
        // Hand back what was actually stored so the card can show a
        // "You uploaded: <file>" receipt — the employee otherwise gets no
        // confirmation of what the server received.
        onUploaded(docId, { fileName: file.name, url: data.publicUrl });
      });
      input.click();
    },
    [employeeName, onUploaded],
  );

  const dismissUploadError = useCallback(() => setUploadError(null), []);

  return { triggerUpload, uploadingDocId, uploadError, dismissUploadError };
}
