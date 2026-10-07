import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/common/AppText';
import { BrandMark } from '@/components/common/BrandMark';
import { Button } from '@/components/common/Button';
import { Glow } from '@/components/common/Glow';
import { Icon, type IconName } from '@/components/common/Icon';
import { RedirectIfSignedIn } from '@/core/auth/guards';
import { GUEST_HOME_ROUTE } from '@/core/auth/role-routes';
import { goTo } from '@/core/navigation/go';
import { useThemePrefs } from '@/store/theme-prefs';
import { accentTone, brandGlow, layout, radius, spacing, useTheme, type AccentTone } from '@/theme';

const TRUST: { icon: IconName; label: string }[] = [
  { icon: 'qrcode', label: 'Giấy phép QR' },
  { icon: 'card-account-details-outline', label: 'Xác minh CCCD' },
  { icon: 'wallet-outline', label: 'MoMo · ZaloPay' },
];

const ROLES: { icon: IconName; tone: AccentTone; title: string; body: string; points: string[] }[] = [
  {
    icon: 'silverware-fork-knife',
    tone: 'primary',
    title: 'Người mua',
    body: 'Tìm quán có giấy phép quanh bạn, đặt món trước và trả tiền online.',
    points: ['Bản đồ quán gần bạn', 'Đặt món, không chờ lâu', 'Đánh giá từ người thật'],
  },
  {
    icon: 'storefront-outline',
    tone: 'secondary',
    title: 'Hộ kinh doanh',
    body: 'Thuê ô vỉa hè hợp lệ, mở gian hàng online và nhận đơn ngay tại quầy.',
    points: ['Chọn ô trống trên bản đồ', 'Nộp hồ sơ không cần lên phường', 'Nhận đơn theo thời gian thực'],
  },
];

/** Public front door for signed-out visitors (StreetBiz-FE's LandingScreen, phone-sized). */
export default function WelcomeScreen() {
  return (
    <RedirectIfSignedIn>
      <Welcome />
    </RedirectIfSignedIn>
  );
}

function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + spacing.md }]}>
        <Glow cx={0} cy={0} r={1} color={brandGlow.from} opacity={0.5} />
        <Glow cx={1} cy={0.75} r={0.65} color={brandGlow.to} opacity={0.18} />

        <View style={styles.topBar}>
          <BrandMark size={26} plate wordmark onHero />
          <HeroThemeToggle />
        </View>

        <View style={[styles.eyebrow, { borderColor: colors.heroLine }]}>
          <View style={[styles.liveDot, { backgroundColor: '#FFB547' }]} />
          <AppText variant="labelSm" style={{ color: colors.heroMuted }}>Nền tảng quản lý vỉa hè số</AppText>
        </View>

        <AppText variant="hero" style={{ color: colors.onHero }}>
          Vỉa hè có trật tự,{'\n'}
          <AppText variant="hero" style={{ color: '#FF8A5B' }}>quán có khách.</AppText>
        </AppText>
        <AppText variant="bodyLg" style={{ color: colors.heroMuted }}>
          Người mua tìm quán có giấy phép. Hộ kinh doanh thuê ô đúng chỗ. Phường duyệt hồ sơ, tất cả trên cùng một nơi.
        </AppText>

        <StreetPreview />

        <View style={styles.ctas}>
          <Button label="Tìm quán quanh đây" icon="map-search-outline" size="lg" onPress={() => goTo(GUEST_HOME_ROUTE)} testID="welcome-browse" />
          <View style={styles.ctaRow}>
            <View style={styles.half}>
              <Button label="Đăng nhập" variant="light" onPress={() => goTo('/(auth)/sign-in')} testID="welcome-sign-in" />
            </View>
            <View style={styles.half}>
              <Button label="Đăng ký bán" variant="glass" iconRight="arrow-right" onPress={() => goTo('/(auth)/register?role=VENDOR')} />
            </View>
          </View>
        </View>

        <View style={styles.trust}>
          {TRUST.map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <Icon name={t.icon} size={16} color={colors.heroMuted} />
              <AppText variant="caption" style={{ color: colors.heroMuted }}>{t.label}</AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.heading}>
          <AppText variant="eyebrow" color="primary">Vai trò</AppText>
          <AppText variant="display">Một nền tảng, đúng việc của bạn</AppText>
        </View>
        {ROLES.map((role) => (
          <RoleCard key={role.title} {...role} />
        ))}

        <View style={styles.heading}>
          <AppText variant="eyebrow" color="primary">Cách hoạt động</AppText>
          <AppText variant="display">Ba bước để lên phố</AppText>
        </View>
        <Steps />
      </View>
    </ScrollView>
  );
}

function HeroThemeToggle() {
  const { scheme, colors } = useTheme();
  const setScheme = useThemePrefs((s) => s.setScheme);
  const dark = scheme === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      onPress={() => setScheme(dark ? 'light' : 'dark')}
      style={({ pressed }) => [styles.glassBtn, { borderColor: colors.heroLine, backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)' }]}
    >
      <Icon name={dark ? 'white-balance-sunny' : 'weather-night'} size={20} color={colors.onHero} />
    </Pressable>
  );
}

/** One block of street: six slots along the kerb and a licensed stall's card (FE's StreetPreview). */
function StreetPreview() {
  const { colors } = useTheme();
  const slots = ['taken', 'taken', 'free', 'taken', 'free', 'taken'] as const;
  return (
    <View style={[styles.preview, { borderColor: colors.heroLine }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.previewHead}>
        <AppText variant="labelSm" style={{ color: colors.heroMuted }}>Tuyến phố mẫu</AppText>
        <View style={styles.freeBadge}>
          <AppText variant="badge" style={{ color: '#5FE0A0' }}>2 ô trống</AppText>
        </View>
      </View>
      <View style={styles.slotGrid}>
        {slots.map((state, i) => (
          <View key={i} style={[styles.slot, state === 'taken' ? styles.slotTaken : styles.slotFree]}>
            {state === 'taken' ? <Icon name="storefront-outline" size={16} color="#FFFFFF" /> : null}
            <AppText variant="caption" style={{ color: state === 'taken' ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}>Ô A-0{i + 1}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.road}>
        <View style={styles.roadLine} />
      </View>
      <View style={[styles.stall, { borderColor: colors.heroLine }]}>
        <View style={styles.stallIcon}>
          <Icon name="silverware-fork-knife" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.stallBody}>
          <AppText variant="labelSm" style={{ color: '#FFFFFF' }} numberOfLines={1}>Bánh mì Cô Ba</AppText>
          <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.55)' }}>Ô A-02 · mở đến 21:00</AppText>
        </View>
        <View style={styles.licensed}>
          <Icon name="check-decagram" size={14} color="#5FE0A0" />
          <AppText variant="badge" style={{ color: '#5FE0A0' }}>Có giấy phép</AppText>
        </View>
      </View>
    </View>
  );
}

function RoleCard({ icon, tone, title, body, points }: (typeof ROLES)[number]) {
  const { colors, shadow } = useTheme();
  const t = accentTone(colors, tone);
  return (
    <View style={[styles.roleCard, shadow.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.roleHead}>
        <View style={[styles.roleIcon, { backgroundColor: t.bg }]}>
          <Icon name={icon} size={24} color={t.fg} />
        </View>
        <AppText variant="title">{title}</AppText>
      </View>
      <AppText color="muted">{body}</AppText>
      <View style={[styles.points, { borderTopColor: colors.border }]}>
        {points.map((p) => (
          <View key={p} style={styles.point}>
            <Icon name="check" size={18} color="tertiary" />
            <AppText>{p}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function Steps() {
  const { colors } = useTheme();
  const steps = [
    { title: 'Tạo tài khoản', body: 'Đăng ký bằng số điện thoại, xác minh bằng mã OTP.' },
    { title: 'Chọn ô, nộp hồ sơ', body: 'Chọn ô trống trên bản đồ, gửi CCCD và ảnh quầy hàng.' },
    { title: 'Nhận QR, lên phố', body: 'Phường duyệt xong, giấy phép QR dán ngay tại quầy.' },
  ];
  return (
    <View style={styles.steps}>
      {steps.map((s, i) => (
        <View key={s.title} style={styles.step}>
          <View style={styles.stepRail}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <AppText variant="labelSm" color="onPrimary">{i + 1}</AppText>
            </View>
            {i < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: colors.border }]} /> : null}
          </View>
          <View style={styles.stepBody}>
            <AppText variant="headline">{s.title}</AppText>
            <AppText color="muted">{s.body}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: layout.screenMargin + 4,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    borderBottomLeftRadius: radius.sheet + 6,
    borderBottomRightRadius: radius.sheet + 6,
    overflow: 'hidden',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  glassBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  ctas: { gap: spacing.sm },
  ctaRow: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  trust: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  preview: { borderRadius: radius.sheet - 4, borderWidth: 1, padding: spacing.md, gap: spacing.sm, backgroundColor: 'rgba(21,24,28,0.85)' },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: 'rgba(11,138,75,0.22)' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { width: '31.9%', height: 54, borderRadius: 12, padding: 8, justifyContent: 'space-between' },
  slotTaken: { backgroundColor: 'rgba(228,68,31,0.28)', borderWidth: 1, borderColor: 'rgba(228,68,31,0.5)' },
  slotFree: { justifyContent: 'flex-end', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(95,224,160,0.6)' },
  road: { height: 30, borderRadius: 10, backgroundColor: '#1A1D22', justifyContent: 'center', paddingHorizontal: 8 },
  roadLine: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)' },
  stall: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  stallIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: brandGlow.from },
  stallBody: { flex: 1, minWidth: 0 },
  licensed: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  body: { padding: layout.screenMargin, paddingTop: spacing.xl, gap: spacing.lg },
  heading: { gap: spacing.xs, marginTop: spacing.sm },
  roleCard: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, padding: spacing.lg, gap: spacing.sm },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roleIcon: { width: 48, height: 48, borderRadius: radius.control + 2, alignItems: 'center', justifyContent: 'center' },
  points: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 6 },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  steps: { gap: 0 },
  step: { flexDirection: 'row', gap: spacing.md },
  stepRail: { alignItems: 'center', width: 32 },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, marginVertical: 4, minHeight: 20 },
  stepBody: { flex: 1, gap: 2, paddingBottom: spacing.lg },
});
