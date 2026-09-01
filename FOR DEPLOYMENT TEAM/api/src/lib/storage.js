// Supabase Storage, reached through the S3 API rather than the Supabase client.
//
// Supabase exposes an S3-compatible endpoint, so the AWS SDK talks to it
// directly. That keeps the stack to one storage client and means the Supabase
// JS library never appears on the server.
//
// Files never pass through this API. The browser uploads to, and downloads
// from, a presigned URL — so a 40 MB attachment does not occupy an Express
// worker for the length of the transfer, and does not hit the 2 MB JSON body
// limit set in index.js. This API only signs and records.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.SUPABASE_S3_ENDPOINT;
const region = process.env.SUPABASE_S3_REGION || 'ap-southeast-1';

const client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '',
  },
  // Supabase routes by path (/bucket/key), not by DNS subdomain.
  forcePathStyle: true,
});

const DEFAULT_EXPIRY = 300; // 5 minutes: long enough to start, short enough to be useless if leaked

/**
 * A URL the browser can PUT one file to.
 *
 * Content-Type is signed in, so the client cannot upload an executable under a
 * key that claims to be a PDF.
 */
export function presignUpload(bucket, key, contentType, expiresIn = DEFAULT_EXPIRY) {
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

/** A URL the browser can GET one file from. */
export function presignDownload(bucket, key, expiresIn = DEFAULT_EXPIRY) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function deleteObject(bucket, key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Size and type of a stored object, or null if it is not there. */
export async function statObject(bucket, key) {
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: r.ContentLength, contentType: r.ContentType, modified: r.LastModified };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/**
 * Build a storage key that cannot escape its prefix.
 *
 * Filenames arrive from users, and Thai filenames are normal here. Rather than
 * sanitising an unbounded character set, keep the original name only in the
 * database and give the object a random key with the extension preserved —
 * traversal, collisions and encoding issues all stop being possible.
 */
export function safeKey(prefix, originalName, random) {
  const ext = String(originalName || '').match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '';
  const clean = String(prefix || '').replace(/^\/+|\/+$/g, '');
  return `${clean}/${random}${ext.toLowerCase()}`;
}

export default { presignUpload, presignDownload, deleteObject, statObject, safeKey };
