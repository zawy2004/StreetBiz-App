import { router, Stack, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import type { ApiRegistration } from '@/core/api';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';
import { colors, fonts, radius, tabular, text } from '@/theme';

type StepState = 'done' | 'current' | 'todo';
type Step = {
  title: string;
  icon: { sf: string; md: string };
  description: string;
  state: StepState;
  cta?: { label: string; to: string };
};

const ACTIVE = ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'];

/** The registration that best says where the vendor stands (the web's pickActive). */
function pickActive(registrations: ApiRegistration[]) {
  const approved = registrations.find((r) => r.registrationStatus === 'APPROVED');
  if (approved) return approved;
  return registrations
    .filter((r) => r.registrationStatus !== 'WITHDRAWN')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

function buildSteps(registrations: ApiRegistration[]): Step[] {
  const active = pickActive(registrations);
  const status = active?.registrationStatus;
  const regPath = active ? `/vendor/home/registrations/${active.registrationId}` : null;
  const approved = status === 'APPROVED';
  const pending = status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  const needInfo = status === 'MORE_INFORMATION_REQUIRED';
  const rejected = status === 'REJECTED';
  const hasFiled = Boolean(active) && ACTIVE.includes(status ?? '');

  return [
    {
      title: 'Tạo tài khoản',
      icon: { sf: 'person.crop.circle.fill', md: 'account_circle' },
      description: 'Số điện thoại của bạn đã được xác thực.',
      state: 'done',
    },
    {
      title: 'Hoàn tất hồ sơ đăng ký hộ kinh doanh',
      icon: { sf: 'doc.text.fill', md: 'description' },
      description: needInfo
        ? 'Phường yêu cầu bổ sung. Hãy cập nhật và nộp lại.'
        : rejected
          ? 'Hồ sơ bị từ chối. Bạn có thể nộp hồ sơ mới.'
          : active
            ? 'Hồ sơ đã nộp.'
            : 'Khai thông tin chủ hộ, ngành nghề và tải giấy tờ (eKYC CCCD).',
      state: hasFiled || approved ? 'done' : 'current',
      cta:
        !active || rejected
          ? { label: 'Bắt đầu hồ sơ', to: '/register-business' }
          : needInfo && regPath
            ? { label: 'Bổ sung hồ sơ', to: regPath }
            : undefined,
    },
    {
      title: 'Chờ phường xét duyệt',
      icon: { sf: 'list.clipboard.fill', md: 'assignment' },
      description: approved
        ? 'Hồ sơ đã được duyệt.'
        : pending
          ? 'Phường đang xem xét hồ sơ của bạn.'
          : needInfo
            ? 'Đang chờ bạn bổ sung thông tin.'
            : 'Sau khi nộp, phường sẽ xét duyệt hồ sơ.',
      state: approved ? 'done' : pending || needInfo ? 'current' : 'todo',
      cta: regPath && (pending || needInfo) ? { label: 'Xem tiến độ', to: regPath } : undefined,
    },
    {
      title: 'Thuê chỗ trên vỉa hè',
      icon: { sf: 'mappin.and.ellipse', md: 'location_on' },
      description: 'Chọn vị trí được phường mở và gửi yêu cầu thuê.',
      state: approved ? 'current' : 'todo',
      cta: approved ? { label: 'Tìm chỗ', to: '/vendor/slots' } : undefined,
    },
    {
      title: 'Mở gian hàng & đăng món',
      icon: { sf: 'storefront.fill', md: 'storefront' },
      description: 'Tạo gian hàng, thêm món và bắt đầu bán.',
      state: 'todo',
      cta: approved ? { label: 'Mở gian hàng', to: '/vendor/home/store' } : undefined,
    },
    {
      title: 'Giấy an toàn thực phẩm (nếu bán đồ ăn)',
      icon: { sf: 'checkmark.shield.fill', md: 'verified_user' },
      description: 'Món thuộc ngành ăn uống cần cam kết hoặc giấy ATTP mới được bán. Nộp trong mục Cửa hàng.',
      state: 'todo',
      cta: approved ? { label: 'Khai giấy ATTP', to: '/vendor/home/store/food-safety' } : undefined,
    },
  ];
}

/**
 * V42 Các bước để bắt đầu bán hàng: six steps from account to open stall, read off the
 * vendor's registrations. Done steps are ticked green, the step to act on now is orange
 * and carries its one button.
 */
export function VendorOnboardingScreen() {
  const { registrations, isLoading, isError, error, refetch, isRefetching } = useRegistrations();
  const steps = useMemo(() => buildSteps(registrations), [registrations]);
  const done = steps.filter((s) => s.state === 'done').length;

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Stack.Screen options={{ title: 'Bắt đầu bán hàng' }} />
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card }}>
        <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[text.title2, { color: colors.ink }]}>Các bước để lên phố</Text>
            <Text style={[text.callout, { color: colors.muted }]}>Làm lần lượt, chúng tôi dẫn bạn từ hồ sơ tới khi mở gian hàng.</Text>
          </View>
          <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 5, borderColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 19, color: colors.primary }, tabular]}>
              {done}/{steps.length}
            </Text>
          </View>
        </View>
        <KerbStrip height={5} segment={20} />
      </View>

      {isLoading ? (
        <ListSkeleton rows={5} height={86} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <View>
          {steps.map((s, i) => {
            const isDone = s.state === 'done';
            const current = s.state === 'current';
            const last = i === steps.length - 1;
            return (
              <View key={s.title} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: isDone ? colors.leaf : current ? colors.cta : colors.card,
                      borderWidth: isDone || current ? 0 : 1.5,
                      borderColor: colors.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isDone ? (
                      <Icon sf="checkmark" md="check" size={17} color={colors.white} weight="bold" />
                    ) : (
                      <Icon sf={s.icon.sf} md={s.icon.md} size={17} color={current ? colors.white : colors.muted} />
                    )}
                  </View>
                  {!last ? <View style={{ flex: 1, width: 2, minHeight: 18, backgroundColor: isDone ? colors.leaf : colors.line, marginVertical: 4 }} /> : null}
                </View>
                <View
                  style={{
                    flex: 1,
                    marginBottom: last ? 0 : 14,
                    padding: current ? 16 : 4,
                    paddingTop: current ? 14 : 8,
                    gap: 6,
                    borderRadius: radius.card,
                    borderCurve: 'continuous',
                    backgroundColor: current ? colors.card : 'transparent',
                    borderWidth: current ? 1.5 : 0,
                    borderColor: colors.brandTint,
                  }}
                  accessibilityLabel={`Bước ${i + 1}: ${s.title}. ${isDone ? 'Đã xong' : current ? 'Đang làm' : 'Chưa tới'}. ${s.description}`}
                >
                  <Text style={[text.headline, { color: isDone ? colors.muted : colors.ink, textDecorationLine: isDone ? 'line-through' : 'none' }]}>
                    {s.title}
                  </Text>
                  <Text style={[text.footnote, { color: colors.muted }]}>{s.description}</Text>
                  {s.cta ? (
                    <Button
                      label={s.cta.label}
                      variant={current ? 'primary' : 'secondary'}
                      onPress={() => router.push(s.cta!.to as Href)}
                      style={{ marginTop: 6, alignSelf: 'flex-start', height: 44, paddingHorizontal: 18 }}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
