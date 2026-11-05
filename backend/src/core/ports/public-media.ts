export const PUBLIC_MEDIA = Symbol('PUBLIC_MEDIA');

/**
 * Storage for images anyone may view: listing photos and site images.
 *
 * Separate from `FileStorage`, which holds private patient documents behind the
 * auth guard. A swap to object storage is one new adapter behind this port.
 */
export interface PublicMediaStorage {
  /** Stores the object and returns the path saved on the record. */
  upload(objectName: string, body: Buffer, mimeType: string): Promise<string>;
  /** Best effort: a missing object is not an error. */
  delete(objectName: string): Promise<void>;
  /** A readable stream for serving the object, or null when it does not exist. */
  open(objectName: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string } | null>;
  /** The object name for one of our own paths, otherwise null. */
  objectNameFromPath(path: string | null | undefined): string | null;
}
