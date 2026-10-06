import { goTo } from '@/core/navigation/go';
import { QrScanner } from '@/services/qr/QrScanner';

export default function ScanScreen() {
  return (
    <QrScanner
      hint="Đưa mã QR vào khung"
      onDetected={(code) => goTo(`/customer/scan-result?code=${encodeURIComponent(code)}`)}
    />
  );
}
