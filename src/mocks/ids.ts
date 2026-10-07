const counters: Record<string, number> = {};

/** Deterministic, readable mock ids, e.g. makeId('REG') -> 'REG-004'. */
export function makeId(prefix: string): string {
  const next = (counters[prefix] ?? 0) + 1;
  counters[prefix] = next;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/**
 * Reserves an id already used by seed data (e.g. 'REG-002') so a later
 * makeId('REG') can never reissue it. Ids that don't match the
 * PREFIX-<digits> shape (e.g. 'USR-CUS') are ignored.
 */
export function reserveId(id: string): void {
  const match = /^([A-Z]+)-(\d+)$/.exec(id);
  if (!match) return;
  const [, prefix, digits] = match;
  if (!prefix || !digits) return;
  counters[prefix] = Math.max(counters[prefix] ?? 0, Number(digits));
}

export function nowIso(): string {
  return new Date().toISOString();
}
