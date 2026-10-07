import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/feedback/States';
import { goTo } from '@/core/navigation/go';

export function GateNotice() {
  return (
    <>
      <EmptyState
        icon="lock-outline"
        title="Chưa mở được gian hàng"
        description="Cần hồ sơ được duyệt và hợp đồng đang hoạt động"
      />
      <Button label="Xem hồ sơ" onPress={() => goTo('/vendor/registrations')} />
    </>
  );
}
