import QRCode from 'react-native-qrcode-svg';

import { colors } from '@/theme';

/**
 * The permit's real, scannable QR (the backend's signed `qrPayload`, BR-39 checks it live).
 * Ink on white with medium error correction, so a scratched screen or glare still scans.
 */
export function PermitQr({ value, size }: { value: string; size: number }) {
  return (
    <QRCode value={value} size={size} color={colors.ink} backgroundColor={colors.white} ecl="M" quietZone={0} />
  );
}
