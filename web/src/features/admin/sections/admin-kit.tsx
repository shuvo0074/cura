import { useRef, useState } from 'react';
import { useServices } from '../../../app/services';
import { appConfig } from '../../../config/env';
import { uiStyles as s } from '../../../ui';

/**
 * Uploaded images are API paths (`/api/directory/media/…`). When the API is on another
 * origin, as in local development, they need that origin; on one origin they work as they are.
 */
export function imageSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const base = appConfig.env.apiBaseUrl;
  if (value.startsWith('/api/')) return /^https?:\/\//.test(base) ? new URL(base).origin + value : value;
  // Other site paths, such as /landing/…, are files Cura Website serves.
  if (value.startsWith('/')) return WEBSITE_URL + value;
  return value;
}

const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL ?? 'https://cura-user-frontend.onrender.com').replace(/\/$/, '');

/**
 * Uploads one image as multipart `photo` to `path` and reports the stored address.
 * Used for site images (`/directory/admin/site-images`, answers `{ url }`) and for a
 * record's own photo (`/directory/admin/<kind>/<id>/photo`, answers `{ photo }`).
 */
export function ImageUpload({
  path,
  label = 'Upload image',
  onUploaded,
}: {
  path: string;
  label?: string;
  onUploaded: (address: string) => void;
}) {
  const { http } = useServices();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('photo', file);
    const result = await http.request<{ url?: string; photo?: string }>(path, { method: 'POST', body: form, retry: false });
    setBusy(false);
    if (input.current) input.current.value = '';
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const address = result.value.url ?? result.value.photo;
    if (address) onUploaded(address);
  };

  return (
    <span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <button type="button" className={s.secondary} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : label}
      </button>
      {error && (
        <span className={s.error} role="alert">
          {' '}
          {error}
        </span>
      )}
    </span>
  );
}

/** Comma-separated text to a trimmed list, and back. */
export const toList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
export const fromList = (value: readonly string[] | null | undefined): string => (value ?? []).join(', ');
