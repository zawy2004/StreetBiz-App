import { router, Stack, type Href } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import type { ApiRegistration } from '@/core/api';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { RoundButton, Signboard, useLightStatusBar } from '@/ui';

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

/** The painted kerb stood on end: the stretch of path already walked, orange and white blocks. */
function KerbRail() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1, width: 6, minHeight: 24, marginVertical: 6, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.kerbPaint }}>
      {/* Absolutely placed so the paint fills the rail without making the row taller. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        {Array.from({ length: 40 }, (_, i) => (
          <View key={i} style={{ height: 9, backgroundColor: i % 2 ? colors.kerbPaint : colors.brand }} />
        ))}
      </View>
    </View>
  );
}

/**
 * V42 Các bước để bắt đầu bán hàng, v5: the stall's signboard counts the steps done; below,
 * six steps from account to open stall, read off the vendor's registrations, joined by a path
 * that is painted kerb where it has been walked. Done steps are ticked green, the step to act
 * on now lifts off the page in white and carries its one orange button.
 */
export function VendorOnboardingScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const { registrations, isLoading, isError, error, refetch, isRefetching } = useRegistrations();
  const steps = useMemo(() => buildSteps(registrations), [registrations]);
  const done = steps.filter((s) => s.state === 'done').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Bắt đầu bán hàng' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.cta} colors={[colors.cta]} progressViewOffset={insets.top} />}
      >
        <Signboard
          top={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RoundButton icon={{ sf: 'chevron.left', md: 'arrow_back' }} label="Quay lại" onPress={() => router.back()} />
            </View>
          }
          line1={`${steps.length} bước`}
          line2="lên phố"
          caption="Làm lần lượt, chúng tôi dẫn bạn từ hồ sơ tới khi mở gian hàng."
        >
          {/* How far along: the count in sign figures, one segment per step */}
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Đã xong ${done} trên ${steps.length} bước`}
            accessibilityValue={{ min: 0, max: steps.length, now: done }}
            style={{ marginTop: 16, gap: 10, padding: 14, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.18)' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.white }]}>
                {isLoading ? '…' : `${done}/${steps.length}`}
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>bước đã xong</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {steps.map((s) => (
                <View key={s.title} style={{ flex: 1, height: 6, borderRadius: radius.full, backgroundColor: s.state === 'done' ? colors.white : s.state === 'current' ? colors.plate : 'rgba(255,255,255,0.35)' }} />
              ))}
            </View>
          </View>
        </Signboard>

        <View style={{ paddingHorizontal: 20 }}>
          {isLoading ? (
            <View style={{ gap: 18 }} accessibilityLabel="Đang tải">
              {Array.from({ length: 5 }, (_, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
                  <Skeleton width={44} height={44} radius={radius.full} />
                  <Skeleton height={i === 1 ? 128 : 64} radius={radius.card} style={{ flex: 1 }} />
                </View>
              ))}
            </View>
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
                    {/* The rail: the step's disc, then the path to the next one */}
                    <View style={{ width: 44, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: radius.full,
                          backgroundColor: isDone ? colors.leaf : current ? colors.cta : colors.card,
                          borderWidth: isDone || current ? 3 : 1.5,
                          borderColor: isDone || current ? colors.white : colors.line,
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: current ? shadow.glow : isDone ? undefined : shadow.card,
                        }}
                      >
                        {isDone ? (
                          <Icon sf="checkmark" md="check" size={19} color={colors.white} weight="bold" />
                        ) : (
                          <Icon sf={s.icon.sf} md={s.icon.md} size={19} color={current ? colors.white : colors.muted} />
                        )}
                      </View>
                      {last ? null : isDone ? <KerbRail /> : <View style={{ flex: 1, width: 3, minHeight: 24, marginVertical: 6, borderRadius: radius.full, backgroundColor: colors.line }} />}
                    </View>
                    <View
                      style={{
                        flex: 1,
                        marginBottom: last ? 0 : 18,
                        padding: current ? 18 : 0,
                        paddingTop: current ? 16 : 10,
                        gap: 6,
                        borderRadius: radius.card,
                        borderCurve: 'continuous',
                        backgroundColor: current ? colors.card : 'transparent',
                        boxShadow: current ? shadow.raised : undefined,
                      }}
                      accessibilityLabel={`Bước ${i + 1}: ${s.title}. ${isDone ? 'Đã xong' : current ? 'Đang làm' : 'Chưa tới'}. ${s.description}`}
                    >
                      <Text style={{ fontFamily: current ? fonts.heavy : fonts.bold, fontSize: current ? 18 : 16, lineHeight: current ? 24 : 22, color: isDone ? colors.muted : colors.ink, textDecorationLine: isDone ? 'line-through' : 'none' }}>
                        {s.title}
                      </Text>
                      <Text style={[text.footnote, { color: isDone ? colors.onLeaf : colors.muted }]}>{s.description}</Text>
                      {s.cta ? (
                        <Button
                          label={s.cta.label}
                          variant={current ? 'primary' : 'secondary'}
                          onPress={() => router.push(s.cta!.to as Href)}
                          style={{ marginTop: 8, alignSelf: current ? 'stretch' : 'flex-start', minHeight: 48, paddingHorizontal: 20 }}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
