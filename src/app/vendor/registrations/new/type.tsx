import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { ChoiceCard } from '@/components/forms/Choices';
import { Stepper } from '@/components/forms/Stepper';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useRegistrationDraft } from '@/features/registration/registration-draft';

export default function RegistrationTypeScreen() {
  const vendorType = useRegistrationDraft((s) => s.vendorType);
  const patch = useRegistrationDraft((s) => s.patch);

  return (
    <>
      <StackHeader title="Đăng ký kinh doanh" />
      <Screen footer={<Button label="Tiếp tục" onPress={() => goTo('/vendor/registrations/new/details')} />}>
        <Stepper step={1} total={4} />
        <AppText variant="title">Bạn kinh doanh theo hình thức nào?</AppText>
        <ChoiceCard
          icon="storefront-outline"
          title="Cửa hàng cố định"
          subtitle="Có địa chỉ, xin ô vỉa hè liền kề"
          selected={vendorType === 'FIXED_STOREFRONT'}
          onPress={() => patch({ vendorType: 'FIXED_STOREFRONT' })}
        />
        <ChoiceCard
          icon="cart-outline"
          title="Bán hàng lưu động"
          subtitle="Không mặt bằng, chọn ô trên bản đồ"
          selected={vendorType === 'ITINERANT'}
          onPress={() => patch({ vendorType: 'ITINERANT' })}
        />
      </Screen>
    </>
  );
}
