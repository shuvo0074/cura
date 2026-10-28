import { api } from '../api/client';

export function buildShareUrl(doctor) {
  return `${window.location.origin}${doctor.slug ? `/dr/${doctor.slug}` : `/doctors/${doctor.id}`}`;
}

export function logShare(doctor) {
  api.post(`/doctors/${doctor.id}/share`).catch(() => {});
}

// Fallback for insecure contexts (plain http, not localhost) where the
// Clipboard API doesn't exist at all — the old execCommand path still works there.
function legacyCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export async function copyShareLink(doctor) {
  const url = buildShareUrl(doctor);
  logShare(doctor);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // fall through to legacy copy below
    }
  }
  return legacyCopy(url);
}

export async function nativeShare(doctor) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: doctor.name, text: doctor.specialty, url: buildShareUrl(doctor) });
    logShare(doctor);
    return true;
  } catch {
    return false;
  }
}
