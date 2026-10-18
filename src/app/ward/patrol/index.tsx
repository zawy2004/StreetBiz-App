import { ComingSoon } from '@/components/layout/ComingSoon';

export default function Route() {
  return (
    <ComingSoon
      title="Tuần tra"
      icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }}
      body="Quét giấy phép, ghi vi phạm."
      group="G5"
    />
  );
}
