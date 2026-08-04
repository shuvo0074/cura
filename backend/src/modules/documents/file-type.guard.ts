/**
 * Content-based file type detection.
 *
 * The `Content-Type` header on a multipart part is attacker-controlled — it is
 * a claim, not evidence. Everything here works from the leading bytes of the
 * buffer instead, so a PHP script renamed to `scan.jpg` and declared as
 * `image/jpeg` is rejected on its actual contents.
 */

export interface DetectedType {
  mimeType: string;
  extension: string;
}

type Signature = {
  mimeType: string;
  extension: string;
  offset: number;
  bytes: number[];
  /** Extra check for container formats where the prefix is not sufficient. */
  verify?: (buffer: Buffer) => boolean;
};

const SIGNATURES: Signature[] = [
  { mimeType: 'image/jpeg', extension: 'jpg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  {
    mimeType: 'image/png',
    extension: 'png',
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mimeType: 'application/pdf', extension: 'pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    offset: 0,
    // RIFF container; bytes 8..11 must spell WEBP.
    bytes: [0x52, 0x49, 0x46, 0x46],
    verify: (buffer) => buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/**
 * Formats that are never accepted regardless of what the client claims.
 *
 * SVG is the notable exclusion: it is XML that can carry `<script>`, so a
 * stored SVG served back to a browser is a stored-XSS primitive. HTML and
 * anything executable is likewise refused.
 */
const NEVER_ACCEPT = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/xml',
  'text/xml',
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-sh',
]);

export function detectFileType(buffer: Buffer): DetectedType | null {
  for (const signature of SIGNATURES) {
    const slice = buffer.subarray(signature.offset, signature.offset + signature.bytes.length);
    if (slice.length !== signature.bytes.length) continue;

    const matches = signature.bytes.every((byte, index) => slice[index] === byte);
    if (!matches) continue;
    if (signature.verify && !signature.verify(buffer)) continue;

    return { mimeType: signature.mimeType, extension: signature.extension };
  }
  return null;
}

export function isForbiddenType(declaredMimeType: string): boolean {
  return NEVER_ACCEPT.has(declaredMimeType.toLowerCase().split(';')[0]?.trim() ?? '');
}

/**
 * Sanitises a client-supplied filename for *display and download only*.
 *
 * The result is never used to build a storage path — that comes from a UUID.
 * This strips directory separators, control characters and leading dots so the
 * value is safe to echo back in a `Content-Disposition` header.
 */
export function sanitiseFileName(raw: string, fallbackExtension: string): string {
  const base = raw
    // Strip control characters: a newline here would let a caller inject
    // additional headers into the Content-Disposition response.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[/\\]/g, '_')
    .replace(/^\.+/, '')
    .replace(/"/g, '')
    .trim()
    .slice(0, 120);

  if (!base) return `upload.${fallbackExtension}`;
  return base.includes('.') ? base : `${base}.${fallbackExtension}`;
}
