import { DocumentCategory, businessRules } from '@cura/shared';

export const CATEGORY_LABELS: Record<string, string> = {
  [DocumentCategory.NID_FRONT]: 'NID — front',
  [DocumentCategory.NID_BACK]: 'NID — back',
  [DocumentCategory.MEDICAL_CERTIFICATE]: 'Medical certificate',
  [DocumentCategory.DIGITAL_SIGNATURE]: 'Digital signature',
  [DocumentCategory.LAB_REPORT]: 'Lab report',
  [DocumentCategory.EXTERNAL_PRESCRIPTION]: 'External prescription',
  [DocumentCategory.OTHER]: 'Other',
};

/**
 * Categories that describe the doctor rather than a patient.
 *
 * The server rejects a patient-scoped category with no patient attached, so the
 * upload form uses this to decide whether the patient picker is required.
 */
export const PROFILE_CATEGORIES: readonly string[] = [
  DocumentCategory.NID_FRONT,
  DocumentCategory.NID_BACK,
  DocumentCategory.MEDICAL_CERTIFICATE,
  DocumentCategory.DIGITAL_SIGNATURE,
];

export const ACCEPTED_TYPES: readonly string[] = [
  ...businessRules.uploads.acceptedImageTypes,
  ...businessRules.uploads.acceptedDocumentTypes,
];

/** `accept` attribute for the file picker. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',');

export const isImage = (mimeType: string): boolean => mimeType.startsWith('image/');
export const isPdf = (mimeType: string): boolean => mimeType === 'application/pdf';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Client-side pre-check before a file leaves the browser.
 *
 * Purely a courtesy: the server re-validates size, runs magic-byte detection
 * and rejects a declared type that disagrees with the bytes. This only spares
 * the doctor a 10 MB round trip to be told no.
 */
export function rejectionReason(file: File): string | null {
  if (file.size === 0) return 'The file is empty.';
  if (file.size > businessRules.uploads.maxFileBytes) {
    return `Larger than the ${Math.round(businessRules.uploads.maxFileBytes / 1024 / 1024)} MB limit.`;
  }
  // An empty type means the OS could not label it; let the server's magic-byte
  // check make the call rather than guessing from the extension.
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP and PDF files are accepted.';
  }
  return null;
}
