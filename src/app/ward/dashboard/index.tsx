import { ComingSoon } from '@/components/layout/ComingSoon';

export default function Route() {
  return (
    <ComingSoon
      title="Tổng quan"
      icon={{ sf: 'chart.bar', md: 'insights' }}
      body="Tình hình vỉa hè của phường."
      group="G5"
    />
  );
}
