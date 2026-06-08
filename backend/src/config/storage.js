import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

/**
 * GridFS-backed object storage facade. Keeps the same function names the rest
 * of the app already uses (putObject / getObjectBuffer / deleteObject) so that
 * services barely change. The logical object "key" is stored as the GridFS
 * file `filename`, so existing keys like `documents/<id>/original-3.pdf` and
 * `signatures/<token>-<uuid>.png` map 1:1 to a GridFS file.
 */

const BUCKET_NAME = 'attachments';
let _bucket = null;

function bucket() {
  if (!_bucket) {
    if (!mongoose.connection?.db) {
      throw new Error('Storage used before MongoDB connection is open');
    }
    _bucket = new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
  }
  return _bucket;
}

/** Find the most recent GridFS file matching a logical key (filename). */
async function findFile(key) {
  const files = await bucket()
    .find({ filename: key })
    .sort({ uploadDate: -1 })
    .limit(1)
    .toArray();
  return files[0] || null;
}

/**
 * Upload a Buffer under `key`. Emulates S3 last-writer-wins overwrite: if files
 * with this key already exist, they're deleted first (important for the
 * deterministic generated-PDF keys like `original-<runNo>.pdf`).
 */
export async function putObject(key, body, contentType) {
  // delete any existing versions of this key
  const existing = await bucket().find({ filename: key }).toArray();
  for (const f of existing) {
    await bucket().delete(f._id).catch(() => {});
  }

  await new Promise((resolvePromise, reject) => {
    const upload = bucket().openUploadStream(key, {
      contentType: contentType || 'application/octet-stream',
    });
    upload.on('error', reject);
    upload.on('finish', resolvePromise);
    upload.end(body);
  });
  return key;
}

/** Fetch an object's bytes as a Buffer. Throws if the key is missing. */
export async function getObjectBuffer(key) {
  const file = await findFile(key);
  if (!file) throw new Error(`Object not found: ${key}`);
  const chunks = [];
  await new Promise((resolvePromise, reject) => {
    const dl = bucket().openDownloadStream(file._id);
    dl.on('data', (c) => chunks.push(c));
    dl.on('error', reject);
    dl.on('end', resolvePromise);
  });
  return Buffer.concat(chunks);
}

/**
 * Open a readable stream for an object (for piping to an HTTP response without
 * buffering the whole file). Returns null if the object is missing.
 */
export async function openDownloadStream(key) {
  const file = await findFile(key);
  if (!file) return null;
  return {
    stream: bucket().openDownloadStream(file._id),
    contentType: file.contentType || 'application/octet-stream',
    length: file.length,
    filename: file.filename,
  };
}

/** Delete all GridFS files for a key. Silently ignores "not found". */
export async function deleteObject(key) {
  const files = await bucket().find({ filename: key }).toArray();
  for (const f of files) {
    await bucket().delete(f._id).catch(() => {});
  }
}
