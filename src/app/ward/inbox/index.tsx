import { ComingSoon } from '@/components/layout/ComingSoon';

export default function Route() {
  return (
    <ComingSoon
      title="Hộp duyệt"
      icon={{ sf: 'tray.full', md: 'inbox' }}
      body="Hồ sơ chờ quyết định."
      group="G5"
    />
  );
}
