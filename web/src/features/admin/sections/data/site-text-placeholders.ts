// Ported from cura_website/src/utils/textPlaceholders.js; refresh this copy when that file changes.

/**
 * The {{placeholders}} in a text, which the site fills in (a count, a name,
 * a phone number). An edited text must keep the same ones, or the page
 * would show "{{count}}" or lose the number.
 */
export function placeholders(text: string | null | undefined): string[] {
  const found = [...String(text ?? '').matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1] ?? '');
  return [...new Set(found)].sort();
}

/** A message about what an edit lost or added, or null when it's fine. */
export function placeholderProblem(builtIn: string | null | undefined, edited: string): string | null {
  const want = placeholders(builtIn);
  const have = placeholders(edited);
  const missing = want.filter((p) => !have.includes(p));
  const extra = have.filter((p) => !want.includes(p));
  if (missing.length) return `Keep ${missing.map((p) => `{{${p}}}`).join(', ')}: the site fills it in`;
  if (extra.length) return `${extra.map((p) => `{{${p}}}`).join(', ')} isn't filled in here; remove it`;
  return null;
}
