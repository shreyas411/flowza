/**
 * Private file storage on AWS S3. Objects are never public; downloads go through short-lived signed URLs.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.S3_BUCKET || '';
const configured = Boolean(bucket && process.env.S3_REGION && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);

const client = configured
  ? new S3Client({
      region: process.env.S3_REGION,
      // Leave S3_ENDPOINT empty for AWS; set it only for S3-compatible providers.
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
    })
  : null;

export const isStorageConfigured = () => configured;

function requireClient() {
  if (!client) throw new Error('File storage is not configured (S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY)');
  return client;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await requireClient().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

/** Signed GET that always downloads (attachment) so uploaded HTML/SVG can never render on our origin. */
export function signedDownloadUrl(key: string, fileName: string, expiresInSec = 300) {
  return getSignedUrl(
    requireClient(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: expiresInSec }
  );
}

export async function deleteObject(key: string) {
  await requireClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
