/**
 * The "(khung 2.000.000 - 3.000.000đ)" a legal basis ends with, as numbers; null when absent.
 * Mirrors LegalBasisText.TryParseBracket on the server, which alone enforces it. (The web copy of
 * this regex lost its backslashes and never matches; this is the intended pattern.)
 */
export function parseFineBracket(legalBasis: string | null | undefined): { min: number; max: number } | null {
  const match = /khung\s+([\d.]+)\s*-\s*([\d.]+)\s*đ/.exec(legalBasis ?? '');
  if (!match) return null;
  const toNumber = (t: string) => Number(t.replace(/\./g, ''));
  return { min: toNumber(match[1] ?? ''), max: toNumber(match[2] ?? '') };
}

/** Whole days left until `iso` (rounded up), negative once passed. Display only. */
export function daysUntil(iso: string, now: number = Date.now()): number {
  return Math.ceil((Date.parse(iso) - now) / 86_400_000);
}

/** "yyyy-mm-dd" of an instant in Vietnam (UTC+7, no DST): the date a rate must be in force on. */
export function vnDateOf(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
}
