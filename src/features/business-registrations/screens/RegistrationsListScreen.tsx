import { router, Stack, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { colors, fonts, radius, text } from '@/theme';
import { RegistrationCard } from '../components/RegistrationParts';
import { useNewRegistrationStore } from '../new-registration-store';
import { useRegistrations } from '../useRegistrations';

const go = (href: string) => router.push(href as Href);

/**
 * V03 Hồ sơ đăng ký kinh doanh (REG-03): each registration as a folder with its tracking line,
 * the reminder that renting a slot is a separate step (BR-08), and the button to file a new one.
 */
export function RegistrationsListScreen() {
  const reset = useNewRegistrationStore((s) => s.reset);
  const { registrations, isLoading, isError, error, refetch, isRefetching } = useRegistrations();
  const hasApproved = registrations.some((r) => r.registrationStatus === 'APPROVED');
  const startNew = () => {
    reset();
    go('/vendor/home/registrations/new/type');
  };

  return (
    <Screen
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      footer={<Button label="Đăng ký kinh doanh mới" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={startNew} />}
    >
      <Stack.Screen options={{ title: 'Hồ sơ đăng ký' }} />
      {isLoading ? (
        <ListSkeleton rows={3} height={170} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : registrations.length === 0 ? (
        <StateView
          icon={{ sf: 'folder.badge.plus', md: 'create_new_folder' }}
          title="Chưa có hồ sơ đăng ký"
          body="Nộp hồ sơ để được phường xét duyệt và nhận giấy phép số."
        />
      ) : (
        registrations.map((r) => (
          <RegistrationCard key={r.registrationId} registration={r} onPress={() => go(`/vendor/home/registrations/${r.registrationId}`)} />
        ))
      )}

      {/* BR-08: registering and renting are two separate applications */}
      <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.signTint }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon sf="info.circle.fill" md="info" size={18} color={colors.sign} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.sign }}>Đăng ký trước, thuê ô sau</Text>
        </View>
        <Text style={[text.footnote, { color: '#2B3640' }]}>
          Hồ sơ hộ kinh doanh và đơn thuê ô vỉa hè là hai việc riêng. Khi hồ sơ được duyệt, bạn mới thuê được ô.
        </Text>
        {hasApproved ? (
          <Button label="Thuê ô vỉa hè" variant="sign" icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} onPress={() => go('/vendor/slots')} />
        ) : null}
      </View>
      {registrations.some((r) => r.registrationStatus === 'MORE_INFORMATION_REQUIRED') ? (
        <Banner tone="warning">Có hồ sơ phường yêu cầu bổ sung. Mở hồ sơ để xem lời nhắn và cập nhật.</Banner>
      ) : null}
    </Screen>
  );
}
