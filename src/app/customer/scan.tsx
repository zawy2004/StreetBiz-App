import { ComingSoon } from '@/components/layout/ComingSoon';

export default function Route() {
  return (
    <ComingSoon
      title="Quét QR"
      icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }}
      body="Quét mã giấy phép ở quầy để kiểm tra với phường."
      group="G4"
    />
  );
}
