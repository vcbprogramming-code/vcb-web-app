import { ApiError } from '../middleware/errorHandler.js';

/**
 * Validate an uploaded raster image before we store + later serve it inline.
 *
 * SVG is a raster-image *mimetype* but an XML document that can carry inline
 * <script>/onload handlers — served back from our origin it becomes stored XSS.
 * So we do NOT trust the client-supplied mimetype at all: we sniff the real
 * magic bytes and only accept PNG / JPEG / GIF / WebP. Returns the sniffed,
 * trustworthy content-type to store (never the client's).
 */
export function assertRasterImage(file, label = 'ไฟล์รูปภาพ') {
  if (!file || !file.buffer || !file.buffer.length) {
    throw new ApiError(400, `${label}ไม่ถูกต้อง`);
  }
  const b = file.buffer;
  const sniff = () => {
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
    if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
  };
  const type = sniff();
  if (!type) {
    throw new ApiError(400, `${label}ต้องเป็นรูปภาพ PNG, JPEG, GIF หรือ WebP เท่านั้น (ไม่รองรับ SVG)`);
  }
  return type;
}
