/**
 * The text a permit QR carries, read the same way as the backend's `PermitQrText` (SIDE-08,
 * BUY-02, WARD-11). A printed price board encodes a link, `{base}/q/{token}?v={version}`, so an
 * ordinary phone camera opens the public page; permits shown before that, and the paste boxes,
 * carry the bare signed token. The link only wraps the signed token: validity is still decided by
 * the signature and a live server lookup (BR-39), never by the link or by this parser.
 */

export const SCAN_PATH = 'q';

export type ScannedPermit = {
  /** What to send as `qrPayload`: the token inside a link, otherwise the trimmed text itself. */
  token: string;
  /** The board version printed on a scanned link (`?v=N`), when there is one. */
  printedVersion: number | null;
  /** True when the text was a /q/ link (a printed board or a permit drawn with its link). */
  fromLink: boolean;
};

/**
 * An absolute http(s) link with a host and no spaces. Read by hand rather than with `URL`, whose
 * React Native version leaves out parts of the parser (`pathname`, `searchParams`).
 */
const isHttpLink = (text: string) => /^https?:\/\/[^/?#\s]+[^\s]*$/i.test(text);

/** The path segments of a link (without the query or fragment). */
function pathSegments(text: string): string[] {
  const afterHost = text.replace(/^https?:\/\/[^/?#]*/i, '');
  const path = afterHost.split(/[?#]/)[0] ?? '';
  return path.split('/').filter(Boolean);
}

function queryVersion(text: string): number | null {
  const query = text.split('#')[0]?.split('?')[1];
  if (!query) return null;
  for (const pair of query.split('&')) {
    const [key, value] = pair.split('=');
    if (key === 'v' && value && /^\d+$/.test(value)) {
      const n = Number(value);
      if (Number.isSafeInteger(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Reads scanned or pasted text. A link of any host is accepted (a board printed while the demo ran
 * on another LAN address still scans); the token is the segment after its last `/q/`. A link that
 * names no token, and any other text, is passed through trimmed and the server says it is not valid.
 */
export function parsePermitQr(text: string): ScannedPermit {
  const trimmed = text.trim();
  if (!isHttpLink(trimmed)) return { token: trimmed, printedVersion: null, fromLink: false };
  const segments = pathSegments(trimmed);
  for (let i = segments.length - 2; i >= 0; i--) {
    if (segments[i] === SCAN_PATH) {
      let token = segments[i + 1]!;
      try {
        token = decodeURIComponent(token);
      } catch {
        // A malformed escape stays as it is; the signature check rejects it.
      }
      return { token, printedVersion: queryVersion(trimmed), fromLink: true };
    }
  }
  return { token: trimmed, printedVersion: null, fromLink: false };
}
