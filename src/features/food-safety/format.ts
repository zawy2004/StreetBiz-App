/** "dd/mm/yyyy" for a "yyyy-mm-dd" date or an ISO timestamp. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
}
