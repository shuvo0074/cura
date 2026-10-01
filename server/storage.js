import { Client } from 'minio';
import { config } from './config.js';

export const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: false,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucket;

export async function uploadBuffer(objectName, buffer, contentType) {
  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, { 'Content-Type': contentType });
  return `/${BUCKET}/${objectName}`;
}

export async function deleteObject(objectName) {
  await minioClient.removeObject(BUCKET, objectName).catch(() => {});
}

export function objectNameFromUrl(url) {
  if (!url) return null;
  const prefix = `/${BUCKET}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}
