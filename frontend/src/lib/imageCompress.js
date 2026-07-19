/**
 * Client-side image compression before upload. Photos/scans from phones are
 * often 5–10 MB; downscaling to a sane max dimension and re-encoding as JPEG
 * shrinks them to ~1 MB with no visible loss for documents — which speeds up the
 * upload, saves server memory, and keeps the merged PDF small.
 *
 * Safety first: only jpeg/png/webp are touched, and on ANY failure (an
 * undecodable format like some HEIC, a canvas error, or no real size gain) the
 * ORIGINAL file is returned unchanged, so an upload never breaks over
 * compression. PDFs / Office files pass straight through.
 */
const COMPRESSIBLE = /^image\/(jpeg|png|webp)$/i;
const MAX_DIM = 2000;      // longest edge, px
const QUALITY = 0.82;      // JPEG quality
const MIN_BYTES = 400 * 1024; // leave images already under ~400 KB alone

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

/**
 * Compress one File. Returns { file, compressed, from, to } — `file` is the
 * (possibly) smaller file, `compressed` true only when it actually shrank.
 */
export async function compressImage(file, { maxDim = MAX_DIM, quality = QUALITY, minBytes = MIN_BYTES } = {}) {
  if (!file || !COMPRESSIBLE.test(file.type) || file.size < minBytes) return { file, compressed: false };
  let handle;
  try {
    handle = await loadImage(file);
    const { img, url } = handle;
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, maxDim / longest);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return { file, compressed: false }; }
    // flatten any transparency onto white so PNG→JPEG doesn't go black
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    // keep the original unless we saved a meaningful amount (≥10%)
    if (!blob || blob.size >= file.size * 0.9) return { file, compressed: false };
    const newName = file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg';
    const out = new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
    return { file: out, compressed: true, from: file.size, to: blob.size };
  } catch {
    if (handle?.url) URL.revokeObjectURL(handle.url);
    return { file, compressed: false };
  }
}

/** Compress a list of files (images shrunk, everything else untouched). */
export async function compressImages(files, opts) {
  return Promise.all(Array.from(files || []).map((f) => compressImage(f, opts)));
}

/** Human-readable byte size, e.g. 1.2 MB / 640 KB. */
export function fmtBytes(b) {
  if (b == null) return '';
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
}
