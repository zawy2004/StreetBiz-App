import { router, Stack, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { RegistrationCard } from '../components/RegistrationParts';
import { useNewRegistrationStore } from '../new-registration-store';
import { useRegistrations } from '../useRegistrations';

const go = (href: string) => router.push(href as Href);

/** One stop of the BR-08 diagram: a round icon and its two words. */
function Stop({ icon, title, note, lit }: { icon: { sf: string; md: string }; title: string; note: string; lit?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 52, height: 52, borderRadius: radius.full, backgroundColor: lit ? colors.cta : colors.brandTint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, boxShadow: lit ? shadow.glow : undefined }}>
        <Icon sf={icon.sf} md={icon.md} size={22} color={lit ? colors.white : colors.primary} />
      </View>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, lineHeight: 19, color: colors.ink, textAlign: 'center' }}>{title}</Text>
      <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' }]}>{note}</Text>
    </View>
  );
}

/**
 * V03 Hồ sơ đăng ký kinh doanh (REG-03), v5: each registration as a folder with its HKD plate and
 * tracking line, the reminder that renting a slot is a separate step (BR-08) drawn as two stops
 * on the kerb, and the button to file a new one in thumb reach.
 */
export function RegistrationsListScreen() {
  const reset = useNewRegistrationStore((s) => s.reset);
  const { registrations, isLoading, isError, error, refetch, isRefetching } = useRegistrations();
  const hasApproved = registrations.some((r) => r.registrationStatus === 'APPROVED');
  const startNew = () => {
    reset();
    go('/register-business');
  };

  return (
    <Screen
      gap={18}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      footer={<Button label="Đăng ký kinh doanh mới" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={startNew} />}
    >
      <Stack.Screen options={{ title: 'Hồ sơ đăng ký' }} />
      {registrations.some((r) => r.registrationStatus === 'MORE_INFORMATION_REQUIRED') ? (
        <Banner tone="warning">Có hồ sơ phường yêu cầu bổ sung. Mở hồ sơ để xem lời nhắn và cập nhật.</Banner>
      ) : null}
      {isLoading ? (
        <ListSkeleton rows={3} height={196} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : registrations.length === 0 ? (
        <StateView
          icon={{ sf: 'folder.badge.plus', md: 'create_new_folder' }}
          title="Chưa có hồ sơ đăng ký"
          body="Nộp hồ sơ để được phường xét duyệt và nhận giấy phép số. Bấm nút bên dưới để bắt đầu."
        />
      ) : (
        registrations.map((r) => (
          <RegistrationCard key={r.registrationId} registration={r} onPress={() => go(`/vendor/home/registrations/${r.registrationId}`)} />
        ))
      )}

      {/* BR-08: registering and renting are two separate applications */}
      <View style={{ marginTop: 8, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <View style={{ padding: 18, gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>
              Đăng ký trước, thuê ô sau
            </Text>
            <Text style={[text.footnote, { color: colors.muted }]}>
              Hồ sơ hộ kinh doanh và đơn thuê ô vỉa hè là hai việc riêng. Khi hồ sơ được duyệt, bạn mới thuê được ô.
            </Text>
          </View>
          <View accessible accessibilityLabel="Bước 1: hồ sơ hộ kinh doanh. Bước 2: thuê ô vỉa hè." style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Stop icon={{ sf: 'doc.text.fill', md: 'description' }} title="Hồ sơ hộ" note="Phường duyệt" lit={!hasApproved} />
            <View style={{ width: 56, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={{ width: 6, height: 2, backgroundColor: hasApproved ? colors.cta : colors.line }} />
              ))}
            </View>
            <Stop icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} title="Thuê ô vỉa hè" note="Nhận giấy phép QR" lit={hasApproved} />
          </View>
          {hasApproved ? (
            <Button label="Thuê ô vỉa hè" variant="secondary" icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} onPress={() => go('/vendor/slots')} />
          ) : null}
        </View>
        <KerbStrip height={6} segment={20} />
      </View>
    </Screen>
  );
}
