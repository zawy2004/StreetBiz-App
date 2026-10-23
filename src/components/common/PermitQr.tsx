import QRCode from 'react-native-qrcode-svg';

import { colors } from '@/theme';

/**
 * The permit's real, scannable QR (the backend's signed `qrPayload`, BR-39 checks it live).
 * With `url` (the permit's `qrUrl`, `{base}/q/{token}`) it draws the link instead, so an ordinary
 * phone camera opens the public check page; the link only wraps the same signed token. Without
 * one it draws `value` as before. Ink on white with medium error correction, so a scratched
 * screen or glare still scans.
 */
export function PermitQr({ value, url, size }: { value: string; url?: string | null; size: number }) {
  return (
    <QRCode value={url || value} size={size} color={colors.ink} backgroundColor={colors.white} ecl="M" quietZone={0} />
  );
}
