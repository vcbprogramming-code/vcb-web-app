import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

/**
 * S3 client pointed at Supabase Storage's S3-compatible endpoint.
 * forcePathStyle is required for Supabase (and most non-AWS S3 services).
 */
export const s3 = new S3Client({
  endpoint: env.s3.endpoint,
  region: env.s3.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

const BUCKET = env.s3.bucket;

/** Ensure the bucket exists (idempotent). Call once at startup. */
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/** Upload a Buffer to S3 under the given key. */
export async function putObject(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/** Fetch an object's bytes as a Buffer. */
export async function getObjectBuffer(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

/** Delete an object. */
export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Presigned URL to download/view an object directly (default 1 hour). */
export function presignedGetUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

/** Presigned URL the browser can PUT a file to directly (default 5 min). */
export function presignedPutUrl(key, contentType, expiresIn = 300) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}
